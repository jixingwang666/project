# 模拟后端（带填充帧）任务要求文档

更新时间：2026-04-17
适用范围：`MOCK_SERVICES/src/mock-backend.js` 及其后续扩展实现

## 1. 目标

为前端与中台联调提供稳定、可重复的帧数据来源，在真实仿真算法未完成前完成以下闭环：

1. 接收中台触发请求。
2. 生成符合 `FrameSnapshot` 语义的时序帧（带字段填充）。
3. 按固定节奏将帧写回中台。
4. 在可选权限保护开启时，支持令牌鉴权头透传。

## 2. 职责边界

1. 模拟后端负责：
- 生成并发送帧数据。
- 保证字段结构合法、时间单调递增。
- 提供可配置随机模式与固定模式。

2. 模拟后端不负责：
- 数据库存储。
- 方案持久化。
- 前端 UI 行为逻辑。
- UE 渲染状态机实现。

3. 中台负责：
- 仿真记录创建与帧落库。
- 帧校验失败的错误返回。
- 对外播放/查询接口。

## 3. 输入契约（中台 -> 模拟后端）

接口：`POST /mock/backend/run`

请求体最小要求：

```json
{
  "simulationId": "sim_xxx",
  "initConfig": {
    "scenarioId": "metro_fire_water_01",
    "mapLevel": "Station_A_Platform",
    "totalPeople": 500
  },
  "options": {
    "fps": 2,
    "totalFrames": 30,
    "randomMode": false
  }
}
```

字段要求：

1. `simulationId` 必填，字符串。
2. `initConfig` 必填，满足最小 `InitConfig` 校验：
- `scenarioId` 非空。
- `mapLevel` 非空。
- `totalPeople > 0`。
3. `options` 选填：
- `fps`：正数，建议范围 `1~30`。
- `totalFrames`：正整数，建议范围 `1~5000`。
- `randomMode`：布尔值。

## 4. 输出契约（模拟后端 -> 中台）

### 4.1 触发响应

收到触发后立刻返回：

```json
{
  "status": "accepted",
  "simulationId": "sim_xxx",
  "fps": 2,
  "totalFrames": 30,
  "intervalMs": 500,
  "randomMode": false
}
```

### 4.2 帧回写

逐帧调用中台：
- `POST /api/simulations/:simId/frames`
- body：`{ "frames": [FrameSnapshot] }`

每个 `FrameSnapshot` 最低要求：

1. 顶层：
- `frameId`
- `simulationId`
- `simTime`
- `frameIndex`
- `status`

2. 场景字段：
- `environment.zones[]` 中包含水/火/烟相关数值。

3. 人群字段：
- `agents[]` 每个 `agentId` 在同帧内唯一。

4. 特殊实体字段：
- `specialEntities[]` 每个 `entityId` 在同帧内唯一。

5. 统计字段：
- `statistics` 至少包含疏散、暴露、伤亡相关指标。

## 5. 带填充规则（必须满足）

1. 时间推进：
- `simTime = frameIndex / fps`。
- 单调递增，不允许回退。

2. 状态填充：
- `status` 默认 `running`。
- 最后一帧允许仍为 `running`，由中台播放状态机决定结束态。

3. 数值边界：
- 概率类字段保持在 `[0, 1]`。
- 非负字段不得出现负数（如浓度、水位、计数、时长）。

4. 一致性：
- `frame.simulationId` 必须与触发请求中的 `simulationId` 一致。

5. 可重复性：
- `randomMode=false` 时同参数输入应得到一致趋势数据。

## 6. 权限与安全要求（新增）

1. 中台开启 `FRAME_INGEST_TOKEN` 时，模拟后端必须携带：
- Header: `x-internal-token: <token>`
- 来源环境变量：`MIDDLEWARE_FRAME_INGEST_TOKEN`

2. 未开启令牌时，保持兼容旧流程，不应强制要求头部。

3. 不在日志中输出完整令牌。

## 7. 失败处理要求

1. 若中台回写失败（非 2xx）：
- 立即停止当前仿真流。
- 输出错误日志，包含帧号、状态码、响应体摘要。

2. 若请求体校验失败：
- 返回 `400 VALIDATION_ERROR`。
- 错误信息必须可定位到缺失字段。

## 8. 验收标准

1. 功能验收：
- 能在 30 帧规模下稳定回写，且中台可查询到对应帧。
- 前端历史查询接口可获取时间范围和样例帧。

2. 结构验收：
- 中台 `validateFrameSnapshot` 不报错。

3. 权限验收：
- 开启 `FRAME_INGEST_TOKEN` 后，无令牌请求应返回 403。
- 设置正确令牌后可正常写帧。

4. 兼容验收：
- 不配置令牌时保留现有联调流程。

## 9. 后续扩展建议

1. 支持批量帧提交（每次 N 帧）以降低请求开销。
2. 引入场景模板库，支持多灾种数据趋势模板。
3. 增加 deterministic seed，便于回归测试比对。
4. 输出阶段统计摘要，便于压测与调优。
