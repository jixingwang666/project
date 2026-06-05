# 数字孪生地铁灾害应急仿真系统

更新时间：2026-06-06

## 系统架构

```
┌──────────────────┐     HTTP/Socket.IO     ┌──────────────────┐     MySQL      ┌──────────┐
│  前端页面 :8080   │ ◄───────────────────── │  中台服务 :3100    │ ────────────── │  MySQL   │
│  (player.html)   │                        │  (Node.js)       │                └──────────┘
│  - 创建仿真       │                        │  - 仿真 CRUD      │
│  - 播放控制       │                        │  - 帧数据存储      │
│  - 历史数据分析    │                        │  - 预案管理       │
│  - 图表可视化     │                        │  - Socket.IO 推送 │
└──────┬───────────┘                        └────────┬─────────┘
       │ WebRTC                                      │ HTTP POST /frames
       ▼                                             │
┌──────────────────┐                                  │
│  Cirrus 信令服务   │                                  ▼
│  :8080 / :8888    │                        ┌──────────────────┐
│  (WebRTC 转发)    │                        │  Mock Backend    │
└──────┬───────────┘                        │  :3200           │
       │ Pixel Streaming                    │  模拟帧数据生成   │
       ▼                                    └──────────────────┘
┌──────────────────┐
│  UE5 客户端       │
│  (PixelDemo)     │
│  - 场景渲染       │
│  - 像素流推流     │
│  - 灾害模拟       │
└──────────────────┘
```

当前联调形态为四部分：

1. **UE 客户端**（Pixel Streaming 推流端）— UE5.7 项目
2. **前端信令服务**（Cirrus，端口 8080 / 8888）— WebRTC + 前端页面
3. **中台服务**（Node.js + MySQL，端口 3100）— 业务逻辑与持久化
4. **Mock Backend**（模拟引擎，端口 3200）— 自动生成仿真帧数据

---

## 一、快速启动

双击项目根目录的 **`start.bat`**，一键启动全部服务：

| 服务 | 端口 | 说明 |
|---|---|---|
| 中台 Middleware | 3100 | 业务 API + Socket.IO |
| 前端信令 Cirrus | 8080 / 8888 | WebRTC + 静态页面 |
| Mock Backend | 3200 | 模拟帧数据生成（无需 UE） |

启动后浏览器打开 **http://localhost:8080/**。

### 不使用 UE 的开发流程

1. 前端页面 → 创建仿真 → 自动触发 Mock Backend 生成 30 帧数据
2. 历史数据页 → 选中仿真 → 查看时序表格 + 曲线图 / 柱状图

---

## 二、目录说明

```
├── start.bat                  ← 一键启动脚本
├── FRONT_UE/                  ← 前端 UI + 信令服务
│   └── frontend/WebServers/SignallingWebServer/
│       ├── www/               ← 静态页面 (player.html, history.html)
│       ├── scripts/           ← 前端 JS
│       │   ├── app-shell.js   ← 主页面逻辑（仿真创建/播放控制/预案）
│       │   ├── history-page.js← 历史数据页（时序表格 + Canvas 图表）
│       │   ├── middleware-client.js ← 中台 HTTP/Socket 客户端
│       │   ├── app.js         ← Pixel Streaming 播放器
│       │   └── webRtcPlayer.js← WebRTC 播放器核心
│       └── cirrus.js          ← 信令服务主程序
├── MIDDLEWARE/                ← 中台服务
│   ├── server/
│   │   └── src/
│   │       ├── http/          ← Express 路由 + 中间件
│   │       ├── repositories/  ← 数据库访问层
│   │       ├── socket/        ← Socket.IO 调度器
│   │       ├── plan/          ← 预案编译引擎
│   │       ├── db/            ← MySQL 连接池 + 初始化
│   │       └── mappers/       ← 数据映射层
│   └── db/sql/                ← 数据库建表脚本
├── MOCK_SERVICES/             ← 模拟仿真服务
│   └── src/
│       ├── engines/           ← 帧生成 + 预案引擎
│       ├── contracts/         ← 数据格式校验
│       ├── mock-backend.js    ← 模拟后端 (端口 3200)
│       └── mock-llm.js        ← 模拟大模型 (端口 3300)
├── UE_PROJECT/                ← UE 打包产物（快捷方式等）
├── DOCS/                      ← 过程文档索引
└── _backup/                   ← 历史备份
```

---

## 三、当前阶段状态

### ✅ 已完成

- 中台 CRUD API（仿真、帧、预案）+ Socket.IO 实时推送
- 前端仿真创建、播放控制、预案面板
- 前端历史数据页：仿真列表、时序表格、**曲线图 / 柱状图**（纯 Canvas，零依赖）
- 数据库自动初始化、幂等性、事务重试
- **Mock Backend**：创建仿真自动触发帧数据生成，全链路打通
- 一键启动脚本 `start.bat`

### ⚠ 待 UE 侧完成

- UE5 项目已完成 C++ 编译和 UIWS 适配
- **待接入 Pixel Streaming 推流**（见下方 UE 接入指南）
- **待实现帧数据上报**（UE → 中台 HTTP POST）
- **待实现前后端指令联动**（前端播放/暂停 → UE 响应）

---

## 四、UE5 接入指南

UE5 项目位置：`D:\Develop\UE5_Projects\subwaydisater\subwaydisater`

### 4.1 项目结构

```
subwaydisater/
├── subwaydisater.uproject     ← UE5.7 项目文件
├── Source/MetroDisasterSim/   ← C++ 灾难管理模块
│   ├── DisasterManager.h/cpp  ← 水火灾害管理器
│   ├── MetroDisasterSim.h/cpp ← 模块入口
│   └── MetroDisasterSim.Build.cs
├── Content/
│   ├── Metro_station/         ← 地铁站场景
│   │   ├── Scenes/Metro_station.umap  ← 主关卡
│   │   ├── Blueprints/        ← 场景物件蓝图
│   │   └── Assets/            ← 模型、材质
│   ├── M5VFXVOL2/             ← 火焰粒子特效
│   └── Population_System/     ← 人群系统
└── Config/                    ← 引擎配置
```

### 4.2 场景操作

**DisasterManager** 已放置在关卡中，运行时按键：

| 按键 | 功能 |
|---|---|
| **1** | 水灾 切换（按一下涨水 / 再一下停水） |
| **2** | 火灾 切换（按一下着火 / 再一下灭火） |
| **3** | 水火同时触发 / 停止 |

**DisasterManager 配置项**（Details 面板）：

- `Fire Events`：火源事件数组，每个条目配置位置、粒子、延迟、蔓延参数
- `Water Body Tag`：通过 Tag 查找水体 Actor
- `Target Water Height`：水面最终 Z 轴高度
- `Water Rise Duration`：上涨总时长（秒）
- `bUseFallbackWaterPlane`：找不到水体时自动生成平面水面

### 4.3 Pixel Streaming 连接（UE → Web）

#### 启用插件

1. 编辑 → 插件 → 搜索 "Pixel Streaming" → 启用
2. 重启编辑器

#### 打包启动参数

```powershell
# 在 WindowsNoEditor 目录执行
.\subwaydisater.exe -PixelStreamingIP=127.0.0.1 -PixelStreamingPort=8888 -AudioMixer -RenderOffscreen
```

关键参数说明：
- `-PixelStreamingIP`：信令服务地址（本地即 127.0.0.1）
- `-PixelStreamingPort`：必须与 `SignallingWebServer/config.json` 中的 `StreamerPort` 一致（当前为 8888）
- `-RenderOffscreen`：无窗口渲染
- `-AudioMixer`：启用音频

#### 编辑器内测试

编辑 → 项目设置 → 插件 → Pixel Streaming → 勾选 "Use Pixel Streaming"

然后点击 Play ▶ 旁边的下拉 → **New Editor Window (PIE)** → 选择 "Pixel Streaming"

UE 控制台输入：`PixelStreamingIP 127.0.0.1`、`PixelStreamingPort 8888`

#### 连通性验证

- UE 启动后，cirrus 控制台应显示：`Streamer connected: ...`
- 浏览器打开 http://localhost:8080/，点「连接所有」→ 应出现 UE 渲染画面

### 4.4 帧数据上报（UE → 中台）

UE 需要定时将仿真帧数据 POST 到中台 API。

**接口**：`POST http://127.0.0.1:3100/api/simulations/{simulationId}/frames`

**请求体格式**：
```json
{
  "frames": [
    {
      "frameIndex": 0,
      "simTime": 0.0,
      "statistics": {
        "totalEvacuated": 0,
        "casualtyCount": 0,
        "inWaterDeep": 80,
        "avgExposureTime": 0
      },
      "environment": {
        "zones": [
          {
            "waterLevel": 0.0,
            "fireIntensity": 0.85,
            "smokeDensity": 0.65,
            "gasConcentration": 0.42
          }
        ]
      },
      "agents": [
        {
          "agentId": "a1",
          "panicLevel": 0.45
        }
      ],
      "specialEntities": [
        {
          "entityId": "device_warning_01",
          "state": "active"
        }
      ]
    }
  ]
}
```

#### 蓝图实现方案

**方案 A：VaRest 插件（推荐）**

1. 从商城安装 **VaRest** 插件（免费，UE5 HTTP 请求工具）
2. 创建一个蓝图函数 `ReportFrame`：

```
┌──────────────────────────────────────────────────┐
│  Event Tick (或 Timer 每 N 秒触发)                │
│     │                                             │
│     ├─ 收集数据                                    │
│     │   ├─ Get Actor Location (水 Actor)           │
│     │   ├─ Get Active Fire Count (DisasterManager) │
│     │   ├─ Get All Actors of Class (Agent)         │
│     │   └─ ...                                    │
│     │                                             │
│     └─ VaRest: Construct JSON Request             │
│           ├─ URL: http://127.0.0.1:3100/api/      │
│           │        simulations/{simId}/frames      │
│           ├─ Verb: POST                            │
│           ├─ Content-Type: application/json        │
│           └─ Body: (构建的帧 JSON)                 │
│               └─ Process Request                   │
└──────────────────────────────────────────────────┘
```

**方案 B：UE5 内置 HTTP（C++ / 蓝图）**

使用 `FHttpModule`：

```cpp
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Json.h"
#include "JsonUtilities.h"

void ReportFrame(const FString& SimulationId, const FFrameSnapshot& Frame)
{
    TSharedRef<IHttpRequest> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(FString::Printf(TEXT("http://127.0.0.1:3100/api/simulations/%s/frames"), *SimulationId));
    Request->SetVerb("POST");
    Request->SetHeader("Content-Type", "application/json");
    Request->SetHeader("x-request-id", FString::Printf(TEXT("ue-%lld"), FDateTime::Now().GetTicks()));

    TSharedPtr<FJsonObject> JsonObj = MakeShareable(new FJsonObject);
    TArray<TSharedPtr<FJsonValue>> FramesArray;
    FramesArray.Add(FrameToJson(Frame));

    JsonObj->SetArrayField("frames", FramesArray);
    FString Body;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Body);
    FJsonSerializer::Serialize(JsonObj.ToSharedRef(), Writer);

    Request->SetContentAsString(Body);
    Request->ProcessRequest();
}
```

#### 上报频率建议

| 仿真速度 | 上报间隔 | 说明 |
|---|---|---|
| 1x | 每秒 1 帧 | 实时同步 |
| 2x | 每秒 2 帧 | 快放 |
| 离线回放 | 每 0.5 秒 | 更平滑的图表曲线 |

### 4.5 指令联动（Web → UE）— 蓝图实现指南

**这是 UE 侧最重要的任务。** 前端用户点击「创建仿真」并勾选了水灾/火灾后，指令通过以下链路到达 UE：

```
前端页面                 中台 Socket.IO           UE (Pixel Streaming)
────────                ────────────             ───────────────────
[创建仿真]  ─POST──▶  创建仿真 + 触发Mock
    │
    │  Socket.IO emit
    ├──────────────▶   PlanCommand 事件
    │                       │
    │                       └── broadcast ──▶  UE 收到 JSON 指令
    │                                              │
    │                                        ┌─────▼──────┐
    │                                        │ Level BP   │
    │                                        │ 解析 JSON  │
    │                                        │ 调用函数    │
    │                                        └────────────┘
```

#### 前端发送的灾害指令格式

前端按钮 | Socket.IO 事件 | UE 收到的 JSON | 应调用的 C++ 函数
---|---|---|---
🔥 火灾 | `PlanCommand` | `{ "action": "triggerFire" }` | `TriggerFire()`
💧 水灾 | `PlanCommand` | `{ "action": "triggerWater" }` | `TriggerWater()`
⚡ 水火同时 | `PlanCommand` | `{ "action": "triggerBoth" }` | `TriggerBoth()`
⏹ 停止 | `PlanCommand` | `{ "action": "stopAll" }` | `StopAll()`

播放控制按钮：

前端按钮 | Socket.IO 事件 | UE 收到的 JSON | 应执行的操作
---|---|---|---
▶ 播放 | `play` | `{ "action": "play" }` | 恢复仿真时间推进
⏸ 暂停 | `pause` | `{ "action": "pause" }` | 暂停仿真
⏮ 后退 | `seek` | `{ "action": "seek", "targetTime": 10 }` | 跳转到目标时间
⏭ 前进 | `seek` | `{ "action": "seek", "targetTime": 20 }` | 跳转到目标时间

---

#### ▎蓝图实现步骤（UE 开发者照着做）

**前置条件**：Pixel Streaming 插件已启用，关卡中已放置 `DisasterManager` Actor。

---

**步骤 1：打开关卡蓝图**

菜单栏 → **Blueprints** → **Open Level Blueprint**（打开当前关卡的蓝图编辑器）

---

**步骤 2：监听 Pixel Streaming 输入事件**

在 Event Graph 中右键 → 搜索 **"Pixel Streaming Input Event"** → 添加节点。

> 这个事件节点是 Pixel Streaming 插件提供的，当前端通过信令服务发送 JSON 字符串时，UE 端会触发此事件，`Data` 引脚输出接收到的字符串。

---

**步骤 3：解析 JSON 字符串**

```
EventGraph 蓝图节点连接：

┌──────────────────────────────┐
│ Pixel Streaming Input Event   │
│   Data (String) ──────────────┤
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Get Json Object Field         │  ← 右键搜索 "Get Json Object Field"
│   ┌─ Json Object: (解析结果)  │
│   └─ Field Name: "action"     │
└──────────────────────────────┘
         │
         ▼  (输出 action 字符串)
    "triggerFire" / "triggerWater" / "triggerBoth" / "stopAll"
```

> 注意：UE 蓝图内置了 JSON 解析节点。先用 **"String to Json Object"** 将字符串转为 JsonObject，再用 **"Get Json Object Field"** 取 `action` 字段。

---

**步骤 4：根据 action 执行不同逻辑**

```
┌──────────────────────────────────┐
│  Equal (String)                   │  ← 比较 action 值
│     A = action                    │
│     B = "triggerFire"             │
└──────────────────────────────────┘
         │ True
         ▼
┌──────────────────────────────────┐
│  Get All Actors of Class          │  ← 获取 DisasterManager
│     Actor Class = DisasterManager │
└──────────────────────────────────┘
         │
         ▼  (取数组第一个)
┌──────────────────────────────────┐
│  TriggerFire                      │  ← 调用 C++ 函数
│     Target = DisasterManager      │
└──────────────────────────────────┘
```

用 **Switch on String** 节点同时处理四个 action，比多个 Equal 更清晰：

```
┌──────────────────────────────────┐
│ Pixel Streaming Input Event       │
│     Data ────► String to Json     │
│     Object ──► Get "action" ──────┤
└──────────────────────────────────┘
         │
         ▼  (action 字符串)
┌──────────────────────────────────┐
│  Switch on String                 │
│     ┌─ "triggerFire"  ──► 调用 DisasterManager.TriggerFire()
│     ├─ "triggerWater" ──► 调用 DisasterManager.TriggerWater()
│     ├─ "triggerBoth"  ──► 调用 DisasterManager.TriggerBoth()
│     └─ "stopAll"      ──► 调用 DisasterManager.StopAll()
└──────────────────────────────────┘
```

---

**步骤 5：处理播放控制指令**

前端播放/暂停/跳转通过 `ControlCommand` 事件发送。同样在 Level BP 中处理：

```
Pixel Streaming Input Event
    │ Data 字符串 → JSON 解析
    │ messageType = "ControlCommand"
    │ payload.action = "play" / "pause" / "seek"
    ▼
Switch on payload.action:
    ├─ "play"  → Set Global Time Dilation = 1.0 + 恢复 Tick
    ├─ "pause" → Set Global Time Dilation = 0.0
    └─ "seek"  → 调整仿真时间（payload.targetTime）
```

---

**步骤 6：订阅 Socket.IO 房间（UE 端注册）**

UE 启动时需要通过 Socket.IO 连接到中台并订阅仿真房间，这样才能收到指令。

在关卡蓝图的 `Event BeginPlay` 中：

1. 通过 Pixel Streaming 发送一个 JSON 消息到前端信令：
   ```json
   { "type": "subscribe", "simulationId": "sim_xxx", "clientRole": "ue" }
   ```

2. 由于 UE 通过 Pixel Streaming 连接到 cirrus，这个 JSON 消息会通过 WebRTC Data Channel 传到浏览器，再由浏览器的 JS 代码转发给中台 Socket.IO。

> **简化方案**：目前中台的 `start.bat` 脚本和前端 `app-shell.js` 里的 `connect-all` 按钮会自动处理订阅。UE 端只需确保 Pixel Streaming 连接成功，前端点击「连接所有」后会自动建立 Socket.IO 连接。后续 UE 开发者可以优化为 UE 自动订阅。

---

**步骤 7：测试验证**

1. 中台 + 前端 + 信令服务启动（`start.bat`）
2. UE 编辑器 Play ▶（Pixel Streaming 模式）
3. 浏览器打开 http://localhost:8080/
4. 点击「连接所有」→ 确认出现 UE 画面
5. 点击「创建仿真」→ 勾选水灾/火灾 → 点「创建仿真」
6. UE 场景中应出现火焰/水面上升效果

---

#### ▎蓝图节点速查

| 需要做的事情 | 搜索的节点名 |
|---|---|
| 接收 Pixel Streaming 消息 | `Pixel Streaming Input Event` |
| 字符串转 JSON | `String to Json Object` |
| 取 JSON 字段 | `Get Json Object Field` |
| 字符串多路分支 | `Switch on String` |
| 获取 DisasterManager | `Get All Actors of Class` |
| 触发火灾 | `TriggerFire`（DisasterManager 的函数） |
| 触发水灾 | `TriggerWater` |
| 同时触发 | `TriggerBoth` |
| 停止一切 | `StopAll` |
| 字符串比较 | `Equal (String)` |
| 打印调试日志 | `Print String` |

---

## 五、API 接口速查

### 中台 (3100)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/healthz` | 健康检查 |
| GET | `/api/simulations` | 仿真列表 |
| POST | `/api/simulations` | 创建仿真（可带 `mockOptions`） |
| GET | `/api/simulations/:id/info` | 仿真时间范围 |
| GET | `/api/simulations/:id/frame?time=` | 按时间查帧 |
| GET | `/api/simulations/:id/frames/all` | 批量取所有帧 |
| POST | `/api/simulations/:id/frames` | 写入帧数据 |
| POST | `/api/plans` | 创建预案 |
| POST | `/api/plans/:id/apply` | 应用预案 |
| POST | `/api/plans/:id/dispatch` | 下发预案指令 |
| POST | `/api/integration/backend/start` | 手动触发模拟引擎 |

### Mock Backend (3200)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/healthz` | 健康检查 |
| POST | `/mock/backend/run` | 启动模拟帧生成 |

---

## 六、项目升级记录

- **2026-06-06**：中台新增 `/frames/all` 批量接口；历史页改用 Canvas 原生绘图（移除 Chart.js CDN 依赖）；Mock Backend 接入一键启动；创建仿真自动触发模拟引擎；README 重写
- 2026-04-01：前端创建仿真页细化；历史数据页拆分独立页面；修复 DOM 空指针错误
- 2026-03：中台数据库自动初始化；C++ DisasterManager 火水控制；Pixel Streaming 信令服务配置
