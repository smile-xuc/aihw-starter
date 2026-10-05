import asyncio
import unittest
from aiohttp import web, ClientSession, WSMsgType
from aiohttp.test_utils import TestServer
from server import create_app, endpoint, MODEL, MAX_BYTES

ORIGIN = 'http://127.0.0.1:8789'
class GatewayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.frames=[];self.starts=[];self.headers=[];self.targets=[];self.finishes=0;self.provider_closed=asyncio.Event();self.fail_provider=False;self.delay_ready=False
        async def provider(request):
            self.headers.append(request.headers.get('Authorization'));ws=web.WebSocketResponse();await ws.prepare(request)
            start=await ws.receive_json();self.starts.append(start);tid=start['header']['task_id']
            async def event(name,payload=None):await ws.send_json({'header':{'event':name,'task_id':tid},'payload':payload or {}})
            if not self.delay_ready:await event('task-started')
            try:
                async for msg in ws:
                    if msg.type==WSMsgType.BINARY:
                        self.frames.append(msg.data)
                        if self.fail_provider:await event('task-failed',{'error':'test-key'});break
                        await event('result-generated',{'output':{'sentence':{'text':'临时','begin_time':0,'end_time':None,'sentence_end':False}}})
                    elif msg.type==WSMsgType.TEXT:
                        self.finishes+=1
                        await event('result-generated',{'output':{'sentence':{'text':'收尾确认','begin_time':0,'end_time':1000,'sentence_end':True}},'usage':{'duration':1}})
                        await event('task-finished');break
            finally:self.provider_closed.set();await ws.close()
            return ws
        app=web.Application();app.router.add_get('/provider',provider);self.provider=TestServer(app);await self.provider.start_server()
        self.http=ClientSession()
        async def connector(target,headers):self.targets.append(target);return await self.http.ws_connect(self.provider.make_url('/provider'),headers=headers)
        self.gateway=TestServer(create_app([ORIGIN],test_connector=connector));await self.gateway.start_server()
    async def asyncTearDown(self):
        await self.http.close();await self.gateway.close();await self.provider.close()
    async def connect(self):
        ws=await self.http.ws_connect(self.gateway.make_url('/asr'),headers={'Origin':ORIGIN})
        await ws.send_json({'type':'start','key':'test-key','region':'cn-beijing','workspace':'test-space'})
        self.assertEqual((await ws.receive_json())['type'],'submitted')
        self.assertEqual((await ws.receive_json())['type'],'ready');return ws
    def test_fixed_targets(self):
        self.assertEqual(endpoint('cn-beijing','abc'),'wss://abc.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference')
        for region,workspace in [('unknown','abc'),('cn-beijing','x.evil'),('cn-beijing','x/anything')]:
            with self.assertRaises(ValueError):endpoint(region,workspace)
    async def test_origin_and_query_rejected_before_provider(self):
        for path,origin in [('/asr','https://evil.example'),('/asr?key=test-key',ORIGIN)]:
            response=await self.http.get(self.gateway.make_url(path),headers={'Origin':origin});self.assertEqual(response.status,403)
        self.assertEqual(self.starts,[])
    async def test_tail_and_header_auth(self):
        ws=await self.connect();await ws.send_bytes(b'\x00\x00'*1600);self.assertFalse((await ws.receive_json())['final'])
        await ws.send_json({'type':'finish'});tail=await ws.receive_json();self.assertTrue(tail['final']);self.assertEqual(tail['text'],'收尾确认');self.assertEqual((await ws.receive_json())['type'],'finished')
        await ws.close();await asyncio.wait_for(self.provider_closed.wait(),2)
        self.assertEqual(self.headers,['Bearer test-key']);self.assertNotIn('test-key',self.targets[0]);self.assertEqual(self.starts[0]['payload']['model'],MODEL);self.assertEqual(self.starts[0]['payload']['parameters'],{'format':'pcm','sample_rate':16000});self.assertEqual(self.finishes,1)
    async def test_invalid_audio_preserves_no_generic_proxy(self):
        ws=await self.connect();await ws.send_bytes(b'odd');self.assertEqual((await ws.receive_json())['type'],'error');await ws.close();self.assertEqual(self.frames,[])
    async def test_disconnect_finishes_existing_task_without_retry(self):
        ws=await self.connect();await ws.close();await asyncio.wait_for(self.provider_closed.wait(),2);self.assertEqual(len(self.starts),1);self.assertEqual(self.finishes,1)
    async def test_provider_failure_does_not_echo_key(self):
        self.fail_provider=True;ws=await self.connect();await ws.send_bytes(b'\x00\x00');message=await ws.receive_json();self.assertEqual(message['type'],'error');self.assertNotIn('test-key',str(message));await ws.close()
    async def test_health_is_not_a_provider_call(self):
        response=await self.http.get(self.gateway.make_url('/health'));data=await response.json();self.assertEqual(data['max_seconds'],180);self.assertEqual(self.starts,[])
    async def test_duration_limit_enforced_on_actual_pcm_bytes(self):
        ws=await self.connect()
        for _ in range(MAX_BYTES//64000+1):await ws.send_bytes(b'\x00'*64000)
        for _ in range(100):
            message=await asyncio.wait_for(ws.receive_json(),2)
            if message['type']=='error':break
        self.assertIn('180',message['message']);self.assertEqual(sum(map(len,self.frames)),MAX_BYTES);await ws.close()
    async def test_audio_before_task_ready_is_rejected(self):
        self.delay_ready=True
        ws=await self.http.ws_connect(self.gateway.make_url('/asr'),headers={'Origin':ORIGIN});await ws.send_json({'type':'start','key':'test-key','region':'cn-beijing','workspace':''});self.assertEqual((await ws.receive_json())['type'],'submitted');await ws.send_bytes(b'\x00\x00');self.assertEqual((await ws.receive_json())['type'],'error');self.assertEqual(self.frames,[]);await ws.close()

if __name__=='__main__':unittest.main()
