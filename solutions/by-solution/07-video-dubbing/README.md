# 🎬 AI 视频翻译配音（跨品类方案）

本仓交付：**视频配音参考实现**，当前用于核对离线流水线与接口契约。该定位仅描述本仓代码，视频配音应用及上游项目的商业化能力独立判断。商业集成需核对声音授权、计费、真实结果与生产服务交付；本仓验证状态见下文。

> 一段中文视频 → 用原说话人的声音说目标语言，时长贴合原画面，背景音保留；同时交付分段字幕 JSON。可接在带屏 AI 硬件或硬件配套 APP 后面，用于「拍完 / 录完 → 一键出海外版」。
>
> 状态：**待真 Key 验证**。离线自检（`python3 selftest.py`）已通过；接口参数按官方文档逐项核对，查证 2026-10-02，需要真跑核对的点见文末「待实测」。

## 适合接在哪里

流水线跑在云端服务或用户电脑上，设备只负责「采集 / 上传」和「播放成片 + 显示字幕」。字幕 JSON 带逐句起止时间和说话人，带屏设备可以直接渲染双语字幕。

| 接入形态 | 典型产品 | 用法 |
|---|---|---|
| 带屏 AI 硬件 | 智能屏、带屏音箱、学习机、[04 Agent 硬件](../../by-category/04-agent-hardware/)里的带屏桌面盒子 / 数字人一体机 | 本地视频或录播课 → 选目标语言 → 设备上播放配音版，屏幕显示双语字幕 |
| 硬件配套 APP | [01 IPC](../../by-category/01-ipc/) 的「一键成片」vlog、[02 AI 眼镜](../../by-category/02-ai-glasses/)拍的第一视角视频、[07 录音卡 / 会议盒子](../../by-category/07-recorder/)的会议录像 | APP 里一键生成英文 / 日文版，分享到海外平台或发给海外同事、亲友 |
| 内容生产工具 | 跨境电商商品讲解、企业培训、短视频出海 | 批量处理：`python3 dub.py input/*.mp4 --target en` |

和 [06 AI 耳机](../../by-category/06-ai-earphone/)的实时同传不同：本方案是离线处理整段视频，换来的是原声音色、时长贴合和背景音保留，适合「做成片」而不是「边听边懂」。

## 流水线

```text
中文视频
  │
  ├─ ① 多说话人 ASR ────── qwen-audio-3.0-asr-flash-filetrans（词级时间戳 + 说话人分离；时间以它为准）
  ├─ ② 一次性校正 ──────── qwen3.8-omni-flash 听原声 + 读转写稿：说话人重标注、身份、情绪卡、同音字建议
  ├─ ③ 时间轴骨架 ──────── pause_plan.py（按停顿切小节 + 音节预算）
  ├─ ④ 翻译 ────────────── qwen3.8-flash 口语化翻译，受音节预算约束；也可导入 Agent 的译文
  ├─ ⑤ 人声分离 ────────── demucs htdemucs（本地 CPU，首次自动安装，保留背景音）
  ├─ ⑥ 参考音频 ────────── 每个说话人截 10~20 秒原声（声音复刻素材，需声明已获授权）
  ├─ ⑦ 声音克隆配音 ────── qwen-audio-3.0-tts-plus 复刻音色 + instruction 情绪控制
  ├─ ⑧ 对齐混音 ────────── smooth_dub.py（零重叠放置 + EBU R128 响度 + 背景音混回）
  └─ ⑨ 质检门禁 ────────── ASR 回查（语言泄漏）+ omni 盲测（音色 / 语速 / 重叠 / 自然度）
  │
  ▼
output/<视频名>.mp4（画面流直接复制，音轨整条替换）+ output/<视频名>.json（分段字幕）
```

## 三步跑通

1. 装 ffmpeg（macOS：`brew install ffmpeg`；Ubuntu：`apt install ffmpeg`）。Python 部分只用标准库；demucs 在第一次跑到⑤时自动 `pip install`（带 PyTorch，约 1 GB）
2. 复制 `.env.example` 为 `.env`，填北京地域的 `DASHSCOPE_API_KEY`，推荐同时填 `DASHSCOPE_WORKSPACE_ID`（`.env` 也可以放在仓库根目录）
3. 运行：

```bash
python3 dub.py input/demo.mp4 --target en --consent
```

`--consent` 表示已经取得视频里每位说话人对声音复刻的授权；不加时一律用系统音色配音，并把②给出的声音描述（性别、年龄段、音色特点）写进语气指令，尽量让不同角色听得出区别。没有 Key 时不会进 mock，可以先跑离线自检：`python3 selftest.py`。

## 交付物

每个视频两个文件：

- `output/<视频名>.mp4`：配音成片。画面流 `-c:v copy` 不重编码；音轨整条替换为「配音 + 背景音」，AAC 192 kbps；文件元数据写入 AIGC 说明。输入是纯音频时交付 `output/<视频名>.wav`
- `output/<视频名>.json`：分段字幕，`schema` 为 `aihw/dub@0.1`

```json
{
  "schema": "aihw/dub@0.1",
  "source": "demo.mp4", "source_lang": "zh", "target_lang": "en", "duration_ms": 61240,
  "speakers": [{"id": "A", "voice": "qwen-audio-3.0-tts-plus-duba-…", "kind": "cloned", "ref_seconds": 15.2,
                "gender": "female", "age": "青年", "role": "主持人"}],
  "segments": [{
    "id": 1, "speaker": "A", "start_ms": 820, "end_ms": 3460,
    "source": "大家好，欢迎来到新品发布会。", "target": "Hi everyone, welcome to the launch!",
    "emotion": "开心", "budget": 11, "syllables": 10,
    "dub": {"at_ms": 820, "dur_ms": 2410, "speed": 1.0, "overflow_ms": 0, "tts_rate": 1.0}
  }],
  "loudness": {"dialog": {"input_i": "-21.3", "target_i": -16.0}, "background": {"input_i": "-30.2", "target_i": -26.0}},
  "qa": {"leaks": [], "blind": {"scores": {"timbre": 4, "pace": 4, "overlap": 5, "naturalness": 4}}, "passed": true},
  "aigc": {"implicit_tag": true, "note": "配音音频由 AI 生成；对外发布须按《人工智能生成合成内容标识办法》添加显式标识"}
}
```

字段：`start_ms` / `end_ms` 是原句时间（来自 ASR 词级时间戳，全程不改）；`dub.at_ms` / `dur_ms` 是配音实际播放的位置；`source_asr` 与 `fixes` 只在采纳了同音字建议时出现；`overflow_ms` 大于 0 表示这句即使加速也放不下，越过了下一句的原开始时间。

## 关键设计

- **时间只认 ASR 的词级时间戳**：小节起止、音节预算、配音放置都从词的 `begin_time` / `end_time` 推出来。omni 的重标注只改说话人标签，不碰时间
- **② omni 双通道校正**：同一次请求里给 omni 原声音频和带时间的转写稿，让它边听边对。ASR 的说话人分离容易把音色相近的两个人合并，omni 结合语义和听感能拆开；同一次请求顺带产出说话人身份、每句的情绪卡和同音字建议。同音字建议只在原文里找得到时才采纳，原文保留在 `source_asr`
- **③ 音节预算是时长贴合的关键**：每个小节的预算 = 原句时长 × 目标语言的配音语速（英语按每秒 4.3 个音节，约为朗读语速的七成，见 `pause_plan.RATES`）；`budget_max` 按到下一句开始前的全部可用时长算。翻译时把预算交给模型，超出 15% 的句子再要求改短一轮
- **④ 也可以交给 Agent 翻译**：`--until plan` 跑到③为止，把 `work/<视频名>/plan.json`（原文、说话人、情绪、预算）交给 Cursor、Claude Code 之类的编码 Agent 按同样的约束翻译，写成 `{"1": "译文", …}` 后用 `--translations` 导入，从④继续
- **⑦ 先合成、再必要时提速**：合成结果比可用时长长 25% 以上时，用 TTS 的 `rate`（最多 1.3）重合成一次，比事后变速自然
- **⑧ 零重叠放置**：每句从原开始时刻起播；前一句没播完就顺延，句间至少留 80 ms；放不下时用 atempo 加速，最多 1.25 倍；只有在下一句很紧时才允许提前 120 ms 开口。对白轨按 −16 LUFS、背景音按 −26 LUFS 两遍 loudnorm（线性归一，不压缩动态），混音后限幅
- **⑨ 质检门禁**：配音对白轨再转写一遍，听到 2 个以上中文字的句子记为语言泄漏；omni 只听配音盲测打分。泄漏、任一项低于 3 分、平均低于 3.5 分或越界超过 300 ms 判为未通过；`--strict` 时退出码为 1，可接进批处理
- **断点续跑**：每一步的结果存在 `work/<视频名>/`，再跑一次直接复用；改了译文只重做⑦以后的步骤，`--fresh` 全部重算

## 常用参数

| 参数 | 说明 |
|---|---|
| `--target ja` | 目标语言：`en` `ja` `ko` `es` `fr` `de` `it` `pt` `ru` `id` `vi` `th` `ar` |
| `--consent` | 声明已取得声音复刻授权；不加时用系统音色 |
| `--voice A=longanhuan_v3.6` | 给某个说话人指定系统音色，可重复 |
| `--speakers 3` | 说话人数量参考值，传给转写 |
| `--until plan` / `--translations my.json` | 交给 Agent 翻译 / 导入译文 |
| `--cheap` | 翻译改用 `qwen3.7-flash` |
| `--no-separation` | 跳过人声分离：参考音频直接取原声，成片不带背景音 |
| `--keep-voices` | 保留复刻音色（默认处理完即删除） |
| `--skip-qa` / `--strict` | 跳过质检 / 质检未通过时退出码为 1 |

## 接口与计费

查证 2026-10-02。地址一律从 `demo_kit.Config` 推导：填了业务空间 ID 走 `{WorkspaceId}.cn-beijing.maas.aliyuncs.com`，否则走通用域名。

| 步骤 | 模型 / 接口 | 关键参数 | 单价（北京） |
|---|---|---|---|
| ① ⑨ 转写 | `qwen-audio-3.0-asr-flash-filetrans`，`POST /api/v1/services/audio/asr/transcription`（异步）+ `GET /api/v1/tasks/{id}` | `diarization_enabled`、`language_hints`；结果 `sentences[].speaker_id`、`words[].begin_time / end_time` | 0.00022 元 / 秒 |
| 上传 | 百炼临时存储 `GET /api/v1/uploads?action=getPolicy` → OSS 表单上传 → `oss://`（48 小时） | 请求头 `X-DashScope-OssResourceResolve: enable` | 免费；官方注明不用于生产 |
| ② ⑨ omni | `qwen3.8-omni-flash`，OpenAI 兼容 Chat Completions，流式 | `input_audio`（Base64 后 <10 MB）、`modalities: ["text"]`、`reasoning_effort: "none"` | 入 0.8、出 2.7 元 / 百万 Token；音频每秒 7 Token |
| ④ 翻译 | `qwen3.8-flash`（`--cheap`：`qwen3.7-flash`） | `enable_thinking: false`、`response_format: json_object` | 入 0.8、出 2.7 元 / 百万 Token |
| ⑥ 复刻 | `voice-enrollment`，`POST /api/v1/services/audio/tts/customization` | `action: create_voice`、`target_model: qwen-audio-3.0-tts-plus`、`url`（公网或临时存储）、`max_prompt_audio_length` 3–30 秒、`enable_preprocess`；删除用 `delete_voice` | 价格页未单列，待实测 |
| ⑦ 合成 | `qwen-audio-3.0-tts-plus`，`POST /api/v1/services/audio/tts/SpeechSynthesizer` | `voice`（复刻音色）、`instruction`（≤100 字符，汉字算 2 个）、`rate` 0.5–2.0、`language_hints`、`enable_aigc_tag: true` | 1.4 元 / 万字符 |

**单次成本估算**（1 分钟、两人对话、译成英语）：转写两遍约 0.026 元，omni 两次约 0.007 元，翻译约 0.005 元，合成约 1,000 字符约 0.14 元，合计约 0.18 元，另加两个复刻音色的费用。合成占大头；`--skip-qa` 省掉第二遍转写和盲测。运行结束会按接口返回的用量打印实际成本。

地域：Qwen-Audio-TTS 的非实时 HTTP 接口只在北京提供，`dub.py` 在其他地域直接退出。新加坡要改走任务制 WebSocket，未实现。

参考：[录音文件识别 HTTP API](https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-http-api) · [声音复刻 / 设计 API](https://help.aliyun.com/zh/model-studio/cosyvoice-clone-design-api) · [非实时语音合成](https://help.aliyun.com/zh/model-studio/non-realtime-tts-user-guide)（含指令控制与情感标签）· [Qwen-Omni](https://help.aliyun.com/zh/model-studio/qwen-omni) · [模型价格](https://help.aliyun.com/zh/model-studio/model-pricing) · [demucs](https://github.com/facebookresearch/demucs)（MIT）

## 合规提示

- **声音复刻要单独同意**：人声属于生物识别信息。按《互联网信息服务深度合成管理规定》，提供人声编辑功能时要提示使用者告知被编辑的个人并取得其单独同意。`dub.py` 默认不复刻，加 `--consent` 才复刻；产品里要把这一步做成说话人本人可确认的授权流程，并留存记录
- **AI 生成内容要标识**：合成音频通过 `enable_aigc_tag` 内嵌隐性标识，成片元数据写入 AIGC 说明。按《人工智能生成合成内容标识办法》，对外发布还要加显式标识，例如带屏设备播放时在画面角落显示「AI 配音」，或在开头加语音提示
- **视频版权**：翻译配音属于对原作品的改编，处理他人作品前要取得权利人授权
- **数据保留**：`work/` 里有原声、人声分离结果和参考音频，处理完按需要删除；复刻音色默认用完即删（`--keep-voices` 才保留）；临时存储的文件 48 小时后失效。量产时改用自己的 OSS + STS，并写明保存期限
- 本方案是开发者参考实现，面向公众上线前要完成生成式 AI 服务登记 / 备案

## 待实测

- [ ] **临时存储地址能否用于声音复刻**：`voice-enrollment` 的 `url` 官方只写了「公网可访问」，`oss://` 加 `X-DashScope-OssResourceResolve` 请求头是否可用、`getPolicy` 的 `model` 参数填 `qwen-audio-3.0-tts-plus` 是否被接受，都要真跑核对；不行时改用自己的 OSS 公网地址
- [ ] **复刻音色 + instruction + 目标语言**：用中文参考音频复刻后合成英语，同时带中文情绪指令，效果与是否报错
- [ ] **omni 重标注效果**：近似音色被 ASR 合并时，omni 能否稳定拆开；音频超过 10 分钟时的 Base64 体积与效果
- [ ] **音节预算的语速取值**：`pause_plan.RATES` 各语言的取值是否合适，越界率多少
- [ ] **voice-enrollment 计费**：价格页未单列，看账单核对
- [ ] **单次成本**：按 `usage` 算出的成本是否落在上面的估算里；TTS 的 `usage.characters` 是否按「一个汉字 2 个字符」返回
- [ ] **业务空间专属域名**：异步转写、复刻、合成在专属域名下是否都连得通

## 文件清单

| 文件 | 作用 |
|---|---|
| `dub.py` | 唯一入口，串起①–⑨，断点续跑 |
| `bailian.py` | 百炼接口：临时存储、异步转写、omni、翻译、复刻、合成，以及用量与单价 |
| `pause_plan.py` | ③ 按停顿切小节、音节计数与预算；可单独运行 |
| `smooth_dub.py` | ⑧ 零重叠放置、对白轨拼接、两遍 loudnorm、混音与封装 |
| `media.py` | ffmpeg / demucs 封装，WAV 读写与截取 |
| `selftest.py` | 离线自检，不需要 Key 和 ffmpeg |
| `demo_kit.py`、`.env.example` | 复制自 [demo 标准](../../demo-standard/README.md) v0.3 的百炼模板（不在 `check.py sync` 的同步范围内，模板升级后需手动跟进）：读 `.env`、推导接入地址、HTTP 传输 |
| `requirements.txt` | 依赖说明（Python 部分仅标准库） |
