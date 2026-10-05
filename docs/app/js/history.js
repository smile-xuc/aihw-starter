import { safeTrace } from './experience.js';
const KEY='aihw.history.v1',LIMIT=20,MAX_BYTES=2*1024*1024;
const storage=()=>globalThis.localStorage;
export function readHistory(store) {
  try {const raw=JSON.parse((store||storage()).getItem(KEY)||'[]');return {records:Array.isArray(raw)?raw.filter(r=>r?.trace?.schema==='aihw/trace@0.1' && typeof r.id==='string').slice(0,LIMIT).map(r=>({id:r.id,trace:safeTrace(r.trace)})):[],error:''};}
  catch {return {records:[],error:'本机存储不可用，体验历史无法读取'};}
}
export function saveHistory(trace,store) {
  try {
    const target=store||storage(); const previous=readHistory(target);
    if(previous.error) throw Error(previous.error);
    // Trace is constructed with a whitelist. Strip URLs defensively even for callers importing a trace.
    const safe=safeTrace(trace);
    const record={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,trace:safe};
    let records=[record,...previous.records].slice(0,LIMIT);
    const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;
    if(bytes([record])>MAX_BYTES) throw Error('本次文本超过历史容量');
    while(bytes(records)>MAX_BYTES) records.pop();
    target.setItem(KEY,JSON.stringify(records)); return {saved:true,record,error:''};
  } catch {return {saved:false,error:'历史未保存：本机存储被禁用、容量不足或本次文本过大。结果仍可复制和导出。'};}
}
export function deleteHistory(id,store) {
  try {(store||storage()).setItem(KEY,JSON.stringify(readHistory(store).records.filter(r=>r.id!==id)));return {saved:true,error:''};}
  catch {return {saved:false,error:'历史删除失败：本机存储不可用'};}
}
export function updateHistory(id,trace,store) {
  try {
    const target=store||storage(),previous=readHistory(target);
    if(previous.error || !previous.records.some(record=>record.id===id))throw Error('记录不存在');
    const records=previous.records.map(record=>record.id===id?{id,trace:safeTrace(trace)}:record);
    if(new TextEncoder().encode(JSON.stringify(records)).length>MAX_BYTES)throw Error('容量不足');
    target.setItem(KEY,JSON.stringify(records));return {saved:true,error:''};
  } catch {return {saved:false,error:'修正未保存到历史：记录已删除、本机存储不可用或容量不足。'};}
}
export function clearHistory(store) {
  try {(store||storage()).setItem(KEY,'[]');return {saved:true,error:''};}
  catch {return {saved:false,error:'历史清除失败：本机存储不可用'};}
}
export const statusLabel=trace=>({success:'成功',failed:'失败',stopped:'已停止'})[trace.status]||'记录';
