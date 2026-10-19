/**
 * SPC 控制系统核心类型定义
 */

export type SPCChartType = 
  | 'xbar-r'   // 均值-极差控制图 (计量型)
  | 'xbar-s'   // 均值-标准差控制图 (计量型)
  | 'i-mr'     // 单值-移动极差控制图 (计量型)
  | 'p'        // 不良率控制图 (计数型，样本容量可变)
  | 'np'       // 不良品数控制图 (计数型，样本容量固定)
  | 'c'        // 缺陷数控制图 (计数型，检验批容量固定)
  | 'u';       // 单位缺陷数控制图 (计数型，检验批容量可变)

export type ChartCategory = 'variable' | 'attribute';

export interface NelsonRuleDefinition {
  id: number;
  name: string;
  shortDesc: string;
  detail: string;
  severity: 'danger' | 'warning' | 'info';
  enabled: boolean;
}

export interface ProcessCharacteristic {
  id: string;
  name: string;                 // 特性名称，如：轴承外径公差
  processName: string;          // 工序名称，如：精磨工序 OP40
  chartType: SPCChartType;      // 控制图类型
  unit: string;                 // 单位，如：mm, V, MPa, pcs
  sampleSize: number;           // 默认子组样本容量 n (如 5)
  isSampleVariable: boolean;    // 样本容量是否波动 (可输入/可变)
  usl?: number;                 // 规格上限 (Upper Specification Limit)
  sl?: number;                  // 规格中心/目标值 (Specification Limit)
  lsl?: number;                 // 规格下限 (Lower Specification Limit)
  deviceList: string[];         // 设备列表，如：CNC-01, CNC-02
  description?: string;
  activeRules: number[];        // 默认激活的 Nelson 规则编号 [1, 2, 3, 4, 5, 6, 7, 8]
}

export interface SubgroupDataPoint {
  id: string;
  seq: number;                  // 序号
  sampleTime: string;           // 采集时间
  batchNo: string;              // 生产批号 (子组聚合核心依据)
  processName: string;          // 工序
  deviceNo: string;             // 设备号
  operator?: string;            // 检验员
  
  // 计量型原始测量值数组 (x1, x2, ... xn) 或 单值
  values: number[];
  
  // 计数型专用字段
  sampleCount?: number;         // 抽样总数 n (计数型)
  defectCount?: number;         // 不良品数 / 缺陷数
  
  // 统计计算值
  n: number;                    // 实际子组容量
  mean: number;                 // 均值 (xbar) 或 单值 (I) 或 不良率 (p) 或 单位缺陷 (u)
  range?: number;               // 极差 R
  stdDev?: number;              // 样本标准差 S
  movingRange?: number;         // 移动极差 MR (针对 I-MR)
  
  // 状态与异常判定
  isVoided: boolean;            // 是否作废/剔除 (作废后不参与控制限计算)
  voidReason?: string;          // 作废原因 (如：试模首件、工装异常已排除)
  voidedAt?: string;
  
  // 判异结果
  violations: {
    ruleId: number;
    ruleName: string;
    chartPart: 'main' | 'sub';  // 均值图违规 还是 极差/标差图违规
    description: string;
  }[];
}

export interface ControlLimits {
  // 主图 (如 Xbar 图, I 图, P 图, NP 图, C 图, U 图)
  ucl: number;                  // 上控制限
  cl: number;                   // 中心线
  lcl: number;                  // 下控制限
  sigma: number;                // 过程波动估算 sigma
  
  // 副图 (如 R 图, S 图, MR 图)
  subUcl?: number;
  subCl?: number;
  subLcl?: number;
  subSigma?: number;
  
  // 变动控制限 (针对样本量 n 变动的 P 图或 U 图)
  hasVariableLimits?: boolean;
  variableLimits?: {
    batchNo: string;
    ucl: number;
    cl: number;
    lcl: number;
  }[];
}

export interface ProcessCapability {
  mean: number;                 // 总均值
  sigmaWithin: number;          // 组内标准差 (用于 Cp, Cpk)
  sigmaOverall: number;         // 整体标准差 (用于 Pp, Ppk)
  cp?: number;
  cpk?: number;
  cpl?: number;
  cpu?: number;
  pp?: number;
  ppk?: number;
  ppl?: number;
  ppu?: number;
  ca?: number;                  // 制程准确度
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  gradeDesc: string;
  ppm?: number;                 // 预估不良率 PPM
}

export interface ExcelTemplateFieldConfig {
  id: string;
  name: string;
  type: 'batchNo' | 'sampleTime' | 'processName' | 'deviceNo' | 'measureValue' | 'sampleCount' | 'defectCount';
  required: boolean;
  description: string;
}

export interface ExcelTemplateConfig {
  processId: string;
  templateName: string;
  chartType: SPCChartType;
  sampleSize: number;
  fields: ExcelTemplateFieldConfig[];
}

/**
 * 审查审计模式类型 (真实数据 vs CN等级 vs 国军标等级)
 */
export type AuditLevelMode = 'real' | 'cn' | 'gjb';

/**
 * CN 等级审查参数配置
 * 需要输入：目标 CPK、控制上下限要求 (UCL/CL/LCL)、规范上下限 (USL/SL/LSL)
 */
export interface CNAuditConfig {
  targetCpk: number;          // CPK 值要求 (如 1.33 或 1.50)
  ucl: number;                // 控制上限要求
  cl: number;                 // 控制中心线要求
  lcl: number;                // 控制下限要求
  usl: number;                // 规范上限 (USL)
  sl: number;                 // 规范中心值 (SL)
  lsl: number;                // 规范下限 (LSL)
  isConfigured: boolean;      // 是否已配置过 (首次输入后记录，后续不用重复输入)
}

/**
 * 国军标等级审查参数配置
 * 需要输入：规范上下限 (USL/SL/LSL)
 * 国军标体系要求高可靠性 (默认标准 Cpk >= 1.67)
 */
export interface GJBAuditConfig {
  targetCpk: number;          // 国军标严苛 CPK 要求 (默认 1.67)
  usl: number;                // 规范上限 (USL)
  sl: number;                 // 规范中心值 (SL)
  lsl: number;                // 规范下限 (LSL)
  isConfigured: boolean;      // 是否已配置过
}

