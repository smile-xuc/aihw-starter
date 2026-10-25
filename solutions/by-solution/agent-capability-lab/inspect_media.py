#!/usr/bin/env python3
"""Real local MM core calls; no host model, credentials or remote endpoints.
Run with the Python from the upstream core virtual environment.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def inspect(args):
    source = Path(args.source).resolve()
    entry = source / 'src/capabilities/core/qwen_mm_plugins_core'
    image = Path(args.image).resolve()
    output = Path(args.output).resolve()
    if not entry.is_dir() or not image.is_file():
        raise ValueError('core source entry or image does not exist')
    video = Path(args.video).resolve() if args.video else None
    if video and not video.is_file():
        raise ValueError('video does not exist')
    output.mkdir(parents=True, exist_ok=True)
    crop = output / 'inspection-crop.png'
    report = output / 'inspection-report.json'
    if crop.exists() or report.exists():
        raise ValueError('output already exists; select a new output directory')
    env = {key: value for key, value in os.environ.items()
           if not any(word in key.upper() for word in ('KEY', 'TOKEN', 'SECRET'))}
    env['QWEN_MM_NATIVE_MODE'] = '1'
    params = StdioServerParameters(command=sys.executable, args=[str(entry)], env=env)
    records = []
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = {tool.name for tool in (await session.list_tools()).tools}
            calls = [('read_image', {'image_path': str(image), 'budget': 'small'}),
                     ('crop', {'image_path': str(image), 'box': [250, 250, 750, 750],
                               'output_path': str(crop)})]
            if video:
                # Inspect metadata before extracting bounded frames.
                calls += [('media_info', {'path': str(video)}),
                          ('read_video', {'video_path': str(video), 'fps': 1,
                                          'max_frames': 3, 'budget': 'small',
                                          'start_time': 0, 'end_time': 3})]
            for name, arguments in calls:
                if name not in tools:
                    raise ValueError('required tool missing: ' + name)
                result = await session.call_tool(name, arguments)
                if result.isError:
                    raise RuntimeError(name + ': ' + '\n'.join(
                        item.text for item in result.content if item.type == 'text'))
                records.append({'tool': name, 'image_blocks': sum(
                    item.type == 'image' for item in result.content),
                    'text': [item.text for item in result.content if item.type == 'text']})
    if not crop.is_file() or not crop.stat().st_size:
        raise RuntimeError('crop did not produce a file')
    result = {'mode': 'local-tools', 'modelCalls': 0, 'source': str(source),
              'crop': str(crop), 'calls': records,
              'note': 'Real media processing only; no semantic understanding or model inference.'}
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'report': str(report), 'crop': str(crop),
                      'tools': [r['tool'] for r in records], 'modelCalls': 0}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, help='Pinned Qwen-MM-Plugins checkout')
    parser.add_argument('--image', required=True)
    parser.add_argument('--video', help='Optional local video, first 3 seconds only')
    parser.add_argument('--output', required=True, help='New output directory')
    try:
        asyncio.run(inspect(parser.parse_args()))
    except (ValueError, RuntimeError) as error:
        parser.exit(1, str(error) + '\n')
