/**
 * 工业级 SPC 仿真样例数据与工序特性库
 * 覆盖全部 7 种控制图：Xbar-R, Xbar-S, I-MR, P, NP, C, U
 */

import { ProcessCharacteristic, SubgroupDataPoint } from '../types/spc';
import { computeSubgroupStats } from '../utils/spcEngine';

export const INITIAL_PROCESSES: ProcessCharacteristic[] = [
  {
    id: 'proc-xbar-r',
    name: '精密轴承内径精磨尺寸',
    processName: '精磨工序 OP40',
    chartType: 'xbar-r',
    unit: 'mm',
    sampleSize: 5,
    isSampleVariable: false,
    usl: 25.025,
    sl: 25.000,
    lsl: 24.975,
    deviceList: ['CNC-GRIND-01', 'CNC-GRIND-02', 'CNC-GRIND-03'],
    description: '轴承内径尺寸关键特性控制，样本容量固定 5 件，采用均值-极差控制图。',
    activeRules: [1, 2, 3, 4, 5, 6, 7, 8]
  },
  {
    id: 'proc-xbar-s',
    name: '新能源汽车电驱端盖壁厚',
    processName: '压铸与精车 OP60',
    chartType: 'xbar-s',
    unit: 'mm',
    sampleSize: 10,
    isSampleVariable: false,
    usl: 4.80,
    sl: 4.50,
    lsl: 4.20,
    deviceList: ['DIE-CAST-08', 'DIE-CAST-09'],
    description: '大容量样本 (n=10) 压铸件壁厚检测，采用均值-标准差 (Xbar-S) 控制图。',
    activeRules: [1, 2, 3, 5, 6]
  },
  {
    id: 'proc-i-mr',
    name: '锂电芯化成开路电压(OCV)',
    processName: '化成与分容工序 OP80',
    chartType: 'i-mr',
    unit: 'V',
    sampleSize: 1,
    isSampleVariable: false,
    usl: 3.700,
    sl: 3.650,
    lsl: 3.600,
    deviceList: ['TEST-OCV-A1', 'TEST-OCV-A2'],
    description: '高价值贵重电池单体化成后单值抽检，采用单值-移动极差 (I-MR) 控制图。',
    activeRules: [1, 2, 3, 4, 5, 6]
  },
  {
    id: 'proc-p',
    name: 'SMT贴片回流焊不良率',
    processName: 'SMT贴装焊接工序',
    chartType: 'p',
    unit: '%',
    sampleSize: 300,
    isSampleVariable: true, // 批次样本量变动
    usl: 0.035, // 3.5%
    sl: 0.015,
    lsl: 0,
    deviceList: ['SMT-LINE-01', 'SMT-LINE-02'],
    description: '表面贴装焊接不良品比例统计，检验批样本容量波动 (300~500 PCS)。',
    activeRules: [1, 2, 3]
  },
  {
    id: 'proc-np',
    name: '手机外壳高光喷涂不良品数',
    processName: '自动喷涂线 OP20',
    chartType: 'np',
    unit: 'pcs',
    sampleSize: 200,
    isSampleVariable: false, // 固定样本容量
    usl: 12,
    sl: 4,
    lsl: 0,
    deviceList: ['SPRAY-BOT-01', 'SPRAY-BOT-02'],
    description: '固定每批抽取 200 个手机外壳，统计气泡、划伤、杂质不良品数量。',
    activeRules: [1, 2]
  },
  {
    id: 'proc-c',
    name: 'PCB板AOI检测焊点缺陷总数',
    processName: 'AOI自动光学检测',
    chartType: 'c',
    unit: '个',
    sampleSize: 20,
    isSampleVariable: false,
    usl: 15,
    sl: 5,
    lsl: 0,
    deviceList: ['AOI-OPTIC-301'],
    description: '固定检验 20 块主板上的全部焊点，缺陷总数控制（泊松分布 C 图）。',
    activeRules: [1, 2, 3]
  },
  {
    id: 'proc-u',
    name: '高压线束插接件缺陷率/单位',
    processName: '线束端子压接工序',
    chartType: 'u',
    unit: '个/件',
    sampleSize: 50,
    isSampleVariable: true, // 批次样本容量波动
    usl: 0.20,
    sl: 0.05,
    lsl: 0,
    deviceList: ['CRIMP-MACH-11', 'CRIMP-MACH-12'],
    description: '统计每根复杂线束上的插接件平均缺陷数 (单位缺陷数 U 图)。',
    activeRules: [1, 2]
  }
];

/**
 * 生成真实的工业批次子组数据
 */
export function generateInitialSubgroups(process: ProcessCharacteristic): SubgroupDataPoint[] {
  const result: SubgroupDataPoint[] = [];
  const baseTime = new Date(Date.now() - 25 * 3600 * 1000);
  const target = process.sl ?? 25.0;
  const tolerance = (process.usl && process.lsl) ? (process.usl - process.lsl) : 0.05;
  const std = tolerance / 6;

  const count = 25; // 25 个历史批次子组

  for (let i = 1; i <= count; i++) {
    const time = new Date(baseTime.getTime() + i * 3600 * 1000);
    const dateStr = time.toISOString().replace('T', ' ').substring(0, 19);
    const batchNo = `LOT-${time.toISOString().slice(2, 10).replace(/-/g, '')}-${String(i).padStart(3, '0')}`;
    const deviceNo = process.deviceList[(i - 1) % process.deviceList.length];

    if (process.chartType === 'xbar-r') {
      const n = 5;
      const values: number[] = [];
      // 模拟工序波动：正常情况围绕 target 波动，第 12 批制造一个可供用户剔除作废的异常点 (刀具突发磨损/首件异常)
      let shift = 0;
      if (i === 12) {
        shift = 0.018; // 触发规则1 (超出3σ) 或规则5
      } else if (i >= 18 && i <= 24) {
        // 轻微正偏移
        shift = 0.003;
      }
      
      for (let j = 0; j < n; j++) {
        // Box-Muller 正态分布随机数
        const u1 = Math.random() || 0.001;
        const u2 = Math.random() || 0.001;
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const val = target + shift + z * (std * 0.7);
        values.push(Number(val.toFixed(4)));
      }

      const stats = computeSubgroupStats(values);

      result.push({
        id: `sg-r-${i}`,
        seq: i,
        sampleTime: dateStr,
        batchNo,
        processName: process.processName,
        deviceNo,
        operator: `QC-${((i % 4) + 1)}`,
        values,
        n,
        mean: Number(stats.mean.toFixed(4)),
        range: Number(stats.range.toFixed(4)),
        stdDev: Number(stats.stdDev.toFixed(4)),
        isVoided: false,
        violations: []
      });
    } else if (process.chartType === 'xbar-s') {
      const n = 10;
      const values: number[] = [];
      let shift = 0;
      if (i === 15) shift = 0.16; // 异常峰值

      for (let j = 0; j < n; j++) {
        const u1 = Math.random() || 0.001;
        const u2 = Math.random() || 0.001;
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const val = target + shift + z * (std * 0.8);
        values.push(Number(val.toFixed(3)));
      }

      const stats = computeSubgroupStats(values);
      result.push({
        id: `sg-s-${i}`,
        seq: i,
        sampleTime: dateStr,
        batchNo,
        processName: process.processName,
        deviceNo,
        operator: `QC-0${((i % 3) + 1)}`,
        values,
        n,
        mean: Number(stats.mean.toFixed(3)),
        range: Number(stats.range.toFixed(3)),
        stdDev: Number(stats.stdDev.toFixed(3)),
        isVoided: false,
        violations: []
      });
    } else if (process.chartType === 'i-mr') {
      const u1 = Math.random() || 0.001;
      const u2 = Math.random() || 0.001;
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const val = target + (i === 9 ? 0.06 : 0) + z * (std * 0.6);
      const valNum = Number(val.toFixed(4));
      
      result.push({
        id: `sg-imr-${i}`,
        seq: i,
        sampleTime: dateStr,
        batchNo,
        processName: process.processName,
        deviceNo,
        operator: `QC-01`,
        values: [valNum],
        n: 1,
        mean: valNum,
        range: 0,
        stdDev: 0,
        isVoided: false,
        violations: []
      });
    } else if (process.chartType === 'p') {
      // 不良率图，波动样本量 300 ~ 500
      const n = process.isSampleVariable ? Math.floor(300 + Math.random() * 200) : 300;
      const baseRate = 0.012; // 1.2%
      const rate = (i === 14 ? 0.038 : baseRate + (Math.random() - 0.5) * 0.008);
      const defectCount = Math.max(0, Math.round(n * rate));

      result.push({
        id: `sg-p-${i}`,
        seq: i,
        sampleTime: dateStr,
        batchNo,
        processName: process.processName,
        deviceNo,
        operator: `QC-SMT`,
        values: [],
        sampleCount: n,
        defectCount,
        n,
        mean: Number((defectCount / n).toFixed(4)),
        isVoided: false,
        violations: []
      });
    } else if (process.chartType === 'np') {
      const n = 200;
      const defectCount = i === 11 ? 14 : Math.max(0, Math.floor(4 + (Math.random() - 0.4) * 5));
      result.push({
        id: `sg-np-${i}`,
        seq: i,
        sampleTime: dateStr,
        batchNo,
        processName: process.processName,
        deviceNo,
        operator: `QC-PAINT`,
        values: [],
        sampleCount: n,
        defectCount,
        n,
        mean: defectCount,
        isVoided: false,
        violations: []
      });
    } else if (process.chartType === 'c') {
      const defectCount = i === 16 ? 16 : Math.max(0, Math.floor(4 + (Math.random() - 0.4) * 4));
      result.push({
        id: `sg-c-${i}`,
        seq: i,
        sampleTime: dateStr,
        batchNo,
        processName: process.processName,
        deviceNo,
        operator: `QC-AOI`,
        values: [],
        sampleCount: 20,
        defectCount,
        n: 20,
        mean: defectCount,
        isVoided: false,
        violations: []
      });
    } else if (process.chartType === 'u') {
      const n = 40 + Math.floor(Math.random() * 30);
      const defectCount = i === 13 ? 12 : Math.max(0, Math.floor(n * 0.05 + (Math.random() - 0.4) * 3));
      result.push({
        id: `sg-u-${i}`,
        seq: i,
        sampleTime: dateStr,
        batchNo,
        processName: process.processName,
        deviceNo,
        operator: `QC-WIRE`,
        values: [],
        sampleCount: n,
        defectCount,
        n,
        mean: Number((defectCount / n).toFixed(4)),
        isVoided: false,
        violations: []
      });
    }
  }

  // 计算 I-MR 移动极差
  if (process.chartType === 'i-mr') {
    for (let i = 1; i < result.length; i++) {
      result[i].movingRange = Number(Math.abs(result[i].mean - result[i - 1].mean).toFixed(4));
    }
  }

  return result;
}
