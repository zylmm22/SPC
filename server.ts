/**
 * SPC 控制系统全栈 Express 服务端
 * 提供 SPC 算法接口、工序与子组持久管理、Excel 模板服务
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { INITIAL_PROCESSES, generateInitialSubgroups } from './src/data/mockData';
import { ProcessCharacteristic, SubgroupDataPoint } from './src/types/spc';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '20mb' }));

// 内存数据库存储
let processesStore: ProcessCharacteristic[] = [...INITIAL_PROCESSES];
let subgroupsStore: Record<string, SubgroupDataPoint[]> = {};

// 初始化预置数据
function initDataStore() {
  processesStore = [...INITIAL_PROCESSES];
  subgroupsStore = {};
  processesStore.forEach(proc => {
    subgroupsStore[proc.id] = generateInitialSubgroups(proc);
  });
}
initDataStore();

// ====================== API 路由 ======================

// 1. 获取所有工序配置
app.get('/api/spc/processes', (_req: Request, res: Response) => {
  res.json({ success: true, data: processesStore });
});

// 2. 新增工序配置
app.post('/api/spc/processes', (req: Request, res: Response) => {
  const newProcess: ProcessCharacteristic = req.body;
  if (!newProcess.id) {
    newProcess.id = `proc-${Date.now()}`;
  }
  processesStore.push(newProcess);
  subgroupsStore[newProcess.id] = generateInitialSubgroups(newProcess);
  res.json({ success: true, data: newProcess });
});

// 3. 更新工序配置
app.put('/api/spc/processes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updated: ProcessCharacteristic = req.body;
  const idx = processesStore.findIndex(p => p.id === id);
  if (idx >= 0) {
    processesStore[idx] = { ...processesStore[idx], ...updated };
    res.json({ success: true, data: processesStore[idx] });
  } else {
    res.status(404).json({ success: false, message: '工序未找到' });
  }
});

// 3.1 删除工序配置及对应子组数据
app.delete('/api/spc/processes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = processesStore.findIndex(p => p.id === id);
  if (idx >= 0) {
    const deleted = processesStore.splice(idx, 1)[0];
    delete subgroupsStore[id];
    res.json({ success: true, data: deleted, message: '工序已成功删除' });
  } else {
    res.status(404).json({ success: false, message: '工序未找到' });
  }
});

// 4. 获取指定工序的全部子组数据
app.get('/api/spc/subgroups', (req: Request, res: Response) => {
  const processId = (req.query.processId as string) || processesStore[0]?.id;
  if (!subgroupsStore[processId]) {
    const proc = processesStore.find(p => p.id === processId);
    if (proc) {
      subgroupsStore[processId] = generateInitialSubgroups(proc);
    } else {
      subgroupsStore[processId] = [];
    }
  }
  res.json({ success: true, data: subgroupsStore[processId] });
});

// 5. 数据作废 / 剔除异常值 (数据作废后系统自动重新计算控制限)
app.post('/api/spc/subgroups/void', (req: Request, res: Response) => {
  const { processId, subgroupId, reason } = req.body;
  const list = subgroupsStore[processId];
  if (!list) {
    return res.status(404).json({ success: false, message: '找不到对应工序数据' });
  }

  const target = list.find(s => s.id === subgroupId);
  if (target) {
    target.isVoided = true;
    target.voidReason = reason || '异常值作废排除';
    target.voidedAt = new Date().toISOString();
    res.json({ success: true, data: target });
  } else {
    res.status(404).json({ success: false, message: '子组未找到' });
  }
});

// 6. 恢复作废的子组
app.post('/api/spc/subgroups/restore', (req: Request, res: Response) => {
  const { processId, subgroupId } = req.body;
  const list = subgroupsStore[processId];
  if (!list) {
    return res.status(404).json({ success: false, message: '找不到对应工序数据' });
  }

  const target = list.find(s => s.id === subgroupId);
  if (target) {
    target.isVoided = false;
    delete target.voidReason;
    delete target.voidedAt;
    res.json({ success: true, data: target });
  } else {
    res.status(404).json({ success: false, message: '子组未找到' });
  }
});

// 7. 批量作废
app.post('/api/spc/subgroups/batch-void', (req: Request, res: Response) => {
  const { processId, subgroupIds, reason } = req.body;
  const list = subgroupsStore[processId];
  if (list && Array.isArray(subgroupIds)) {
    list.forEach(item => {
      if (subgroupIds.includes(item.id)) {
        item.isVoided = true;
        item.voidReason = reason || '批量作废排除';
        item.voidedAt = new Date().toISOString();
      }
    });
  }
  res.json({ success: true, count: subgroupIds?.length || 0 });
});

// 8. 批量恢复
app.post('/api/spc/subgroups/batch-restore', (req: Request, res: Response) => {
  const { processId, subgroupIds } = req.body;
  const list = subgroupsStore[processId];
  if (list && Array.isArray(subgroupIds)) {
    list.forEach(item => {
      if (subgroupIds.includes(item.id)) {
        item.isVoided = false;
        delete item.voidReason;
        delete item.voidedAt;
      }
    });
  }
  res.json({ success: true, count: subgroupIds?.length || 0 });
});

// 9. 导入 Excel 解析出的子组数据
app.post('/api/spc/subgroups/import', (req: Request, res: Response) => {
  const { processId, subgroups } = req.body;
  if (!Array.isArray(subgroups)) {
    return res.status(400).json({ success: false, message: '非法子组数据' });
  }
  subgroupsStore[processId] = subgroups;
  res.json({ success: true, count: subgroups.length });
});

// 10. 重置为内置工业仿真演示数据
app.post('/api/spc/reset-demo', (_req: Request, res: Response) => {
  initDataStore();
  res.json({ success: true, message: '工业演示数据已重置' });
});

// 健康检查
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ====================== 前端中间件挂载 ======================

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // 生产模式静态文件
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[SPC System] Server running on port ${PORT}`);
  });
}

startServer();
