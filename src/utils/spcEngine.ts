/**
 * SPC 控制图算法引擎
 * 遵循 ISO 7870 & AIAG SPC 4th 标准
 */

import { 
  SubgroupDataPoint, 
  ControlLimits, 
  SPCChartType, 
  ProcessCapability 
} from '../types/spc';
import { getSPCConstants } from './spcConstants';

/**
 * 计算单个子组统计量 (均值, 极差, 标准差)
 */
export function computeSubgroupStats(values: number[]): { mean: number; range: number; stdDev: number; n: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, range: 0, stdDev: 0, n: 0 };
  
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  
  if (n === 1) {
    return { mean, range: 0, stdDev: 0, n: 1 };
  }
  
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  
  // 样本无偏标准差 s = sqrt(sum((x - mean)^2) / (n - 1))
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(Math.max(0, variance));
  
  return { mean, range, stdDev, n };
}

/**
 * 计算控制限 (UCL, CL, LCL)
 */
export function calculateControlLimits(
  subgroups: SubgroupDataPoint[],
  chartType: SPCChartType
): ControlLimits {
  const activeSubgroups = subgroups.filter(sg => !sg.isVoided);
  const k = activeSubgroups.length;
  
  if (k === 0) {
    return { ucl: 0, cl: 0, lcl: 0, sigma: 0 };
  }

  const avgN = activeSubgroups.reduce((sum, sg) => sum + (sg.n || (sg.values?.length || 1)), 0) / k;
  const factors = getSPCConstants(avgN);

  switch (chartType) {
    case 'xbar-r': {
      const xbarTotal = activeSubgroups.reduce((acc, sg) => acc + sg.mean, 0);
      const rTotal = activeSubgroups.reduce((acc, sg) => acc + (sg.range ?? 0), 0);
      const xDoubleBar = xbarTotal / k;
      const rBar = rTotal / k;
      
      const xUcl = xDoubleBar + factors.A2 * rBar;
      const xLcl = xDoubleBar - factors.A2 * rBar;
      const sigma = factors.d2 > 0 ? rBar / factors.d2 : (xUcl - xDoubleBar) / 3;
      
      const rUcl = factors.D4 * rBar;
      const rCl = rBar;
      const rLcl = factors.D3 * rBar;
      
      return {
        ucl: Number(xUcl.toFixed(4)),
        cl: Number(xDoubleBar.toFixed(4)),
        lcl: Number(xLcl.toFixed(4)),
        sigma: Number(sigma.toFixed(4)),
        subUcl: Number(rUcl.toFixed(4)),
        subCl: Number(rCl.toFixed(4)),
        subLcl: Number(rLcl.toFixed(4)),
        subSigma: Number((rBar * (factors.d3 / factors.d2)).toFixed(4))
      };
    }

    case 'xbar-s': {
      const xbarTotal = activeSubgroups.reduce((acc, sg) => acc + sg.mean, 0);
      const sTotal = activeSubgroups.reduce((acc, sg) => acc + (sg.stdDev ?? 0), 0);
      const xDoubleBar = xbarTotal / k;
      const sBar = sTotal / k;
      
      const xUcl = xDoubleBar + factors.A3 * sBar;
      const xLcl = xDoubleBar - factors.A3 * sBar;
      const sigma = factors.c4 > 0 ? sBar / factors.c4 : (xUcl - xDoubleBar) / 3;
      
      const sUcl = factors.B4 * sBar;
      const sCl = sBar;
      const sLcl = factors.B3 * sBar;
      
      return {
        ucl: Number(xUcl.toFixed(4)),
        cl: Number(xDoubleBar.toFixed(4)),
        lcl: Number(xLcl.toFixed(4)),
        sigma: Number(sigma.toFixed(4)),
        subUcl: Number(sUcl.toFixed(4)),
        subCl: Number(sCl.toFixed(4)),
        subLcl: Number(sLcl.toFixed(4))
      };
    }

    case 'i-mr': {
      const xTotal = activeSubgroups.reduce((acc, sg) => acc + sg.mean, 0);
      const xBar = xTotal / k;
      
      let mrTotal = 0;
      let mrCount = 0;
      for (let i = 1; i < activeSubgroups.length; i++) {
        const mr = Math.abs(activeSubgroups[i].mean - activeSubgroups[i - 1].mean);
        mrTotal += mr;
        mrCount++;
      }
      const mrBar = mrCount > 0 ? mrTotal / mrCount : 0;
      const d2_2 = 1.128;
      const sigma = d2_2 > 0 ? mrBar / d2_2 : 0;
      
      const ucl = xBar + 3 * (mrBar / d2_2);
      const lcl = xBar - 3 * (mrBar / d2_2);
      
      const mrUcl = 3.267 * mrBar;
      const mrCl = mrBar;
      const mrLcl = 0;
      
      return {
        ucl: Number(ucl.toFixed(4)),
        cl: Number(xBar.toFixed(4)),
        lcl: Number(lcl.toFixed(4)),
        sigma: Number(sigma.toFixed(4)),
        subUcl: Number(mrUcl.toFixed(4)),
        subCl: Number(mrCl.toFixed(4)),
        subLcl: Number(mrLcl.toFixed(4))
      };
    }

    case 'p': {
      const totalDefects = activeSubgroups.reduce((acc, sg) => acc + (sg.defectCount ?? 0), 0);
      const totalSamples = activeSubgroups.reduce((acc, sg) => acc + (sg.sampleCount ?? sg.n ?? 100), 0);
      const pBar = totalSamples > 0 ? totalDefects / totalSamples : 0;
      
      const sampleSizes = activeSubgroups.map(sg => sg.sampleCount ?? sg.n ?? 100);
      const isVariable = Math.max(...sampleSizes) !== Math.min(...sampleSizes);
      
      const avgSampleSize = totalSamples / k;
      const stdErr = Math.sqrt(Math.max(0, (pBar * (1 - pBar)) / avgSampleSize));
      
      const ucl = Math.min(1, pBar + 3 * stdErr);
      const lcl = Math.max(0, pBar - 3 * stdErr);
      
      let variableLimits: { batchNo: string; ucl: number; cl: number; lcl: number }[] | undefined = undefined;
      if (isVariable) {
        variableLimits = activeSubgroups.map(sg => {
          const ni = sg.sampleCount ?? sg.n ?? avgSampleSize;
          const se = Math.sqrt(Math.max(0, (pBar * (1 - pBar)) / ni));
          return {
            batchNo: sg.batchNo,
            ucl: Number(Math.min(1, pBar + 3 * se).toFixed(4)),
            cl: Number(pBar.toFixed(4)),
            lcl: Number(Math.max(0, pBar - 3 * se).toFixed(4))
          };
        });
      }
      
      return {
        ucl: Number(ucl.toFixed(4)),
        cl: Number(pBar.toFixed(4)),
        lcl: Number(lcl.toFixed(4)),
        sigma: Number(stdErr.toFixed(4)),
        hasVariableLimits: isVariable,
        variableLimits
      };
    }

    case 'np': {
      const totalDefects = activeSubgroups.reduce((acc, sg) => acc + (sg.defectCount ?? 0), 0);
      const totalSamples = activeSubgroups.reduce((acc, sg) => acc + (sg.sampleCount ?? sg.n ?? 100), 0);
      const pBar = totalSamples > 0 ? totalDefects / totalSamples : 0;
      const nFixed = activeSubgroups[0]?.sampleCount ?? activeSubgroups[0]?.n ?? 100;
      const npBar = nFixed * pBar;
      
      const npSigma = Math.sqrt(Math.max(0, nFixed * pBar * (1 - pBar)));
      const ucl = npBar + 3 * npSigma;
      const lcl = Math.max(0, npBar - 3 * npSigma);
      
      return {
        ucl: Number(ucl.toFixed(2)),
        cl: Number(npBar.toFixed(2)),
        lcl: Number(lcl.toFixed(2)),
        sigma: Number(npSigma.toFixed(2))
      };
    }

    case 'c': {
      const totalC = activeSubgroups.reduce((acc, sg) => acc + (sg.defectCount ?? sg.mean ?? 0), 0);
      const cBar = totalC / k;
      const cSigma = Math.sqrt(Math.max(0, cBar));
      
      const ucl = cBar + 3 * cSigma;
      const lcl = Math.max(0, cBar - 3 * cSigma);
      
      return {
        ucl: Number(ucl.toFixed(2)),
        cl: Number(cBar.toFixed(2)),
        lcl: Number(lcl.toFixed(2)),
        sigma: Number(cSigma.toFixed(2))
      };
    }

    case 'u': {
      const totalC = activeSubgroups.reduce((acc, sg) => acc + (sg.defectCount ?? 0), 0);
      const totalN = activeSubgroups.reduce((acc, sg) => acc + (sg.sampleCount ?? sg.n ?? 1), 0);
      const uBar = totalN > 0 ? totalC / totalN : 0;
      const avgN = totalN / k;
      const uSigma = Math.sqrt(Math.max(0, uBar / avgN));
      
      const ucl = uBar + 3 * uSigma;
      const lcl = Math.max(0, uBar - 3 * uSigma);
      
      const sampleSizes = activeSubgroups.map(sg => sg.sampleCount ?? sg.n ?? 1);
      const isVariable = Math.max(...sampleSizes) !== Math.min(...sampleSizes);
      let variableLimits: { batchNo: string; ucl: number; cl: number; lcl: number }[] | undefined = undefined;
      
      if (isVariable) {
        variableLimits = activeSubgroups.map(sg => {
          const ni = sg.sampleCount ?? sg.n ?? avgN;
          const se = Math.sqrt(Math.max(0, uBar / ni));
          return {
            batchNo: sg.batchNo,
            ucl: Number((uBar + 3 * se).toFixed(4)),
            cl: Number(uBar.toFixed(4)),
            lcl: Number(Math.max(0, uBar - 3 * se).toFixed(4))
          };
        });
      }
      
      return {
        ucl: Number(ucl.toFixed(4)),
        cl: Number(uBar.toFixed(4)),
        lcl: Number(lcl.toFixed(4)),
        sigma: Number(uSigma.toFixed(4)),
        hasVariableLimits: isVariable,
        variableLimits
      };
    }
  }
}

/**
 * Nelson 8大判异规则实时检测
 * @param chartType 图表类型，用于精确定位副图统计量（S / R / MR）
 */
export function evaluateNelsonRules(
  subgroups: SubgroupDataPoint[],
  limits: ControlLimits,
  enabledRuleIds: number[],
  chartPart: 'main' | 'sub' = 'main',
  chartType: SPCChartType = 'xbar-s'
): SubgroupDataPoint[] {
  const cl = chartPart === 'main' ? limits.cl : (limits.subCl ?? limits.cl);
  const ucl = chartPart === 'main' ? limits.ucl : (limits.subUcl ?? limits.ucl);
  const lcl = chartPart === 'main' ? limits.lcl : (limits.subLcl ?? limits.lcl);
  
  const sigma = (ucl - cl) / 3;
  
  const evaluated = subgroups.map(sg => ({
    ...sg,
    violations: sg.violations ? sg.violations.filter(v => v.chartPart !== chartPart) : []
  }));

  if (sigma <= 0 || evaluated.length === 0) {
    return evaluated;
  }

  // ✅ 核心修复 1: 精准提取子组点，彻底避免 S 图误取 range 导致超差爆红
  const values = evaluated.map(sg => {
    if (chartPart === 'main') {
      return sg.mean;
    }
    // 副图严格按照控制图类型提取对应统计量
    if (chartType === 'xbar-s') {
      return sg.stdDev !== undefined ? sg.stdDev : (sg.range ?? 0);
    }
    if (chartType === 'i-mr') {
      return sg.movingRange !== undefined ? sg.movingRange : (sg.range ?? 0);
    }
    return sg.range !== undefined ? sg.range : (sg.stdDev ?? 0);
  });

  // ✅ 核心修复 2: 副图严格遵循 GB/T 4091 规范，禁止对非正态的 S 图/R 图套用 5/6/7/8 规则
  const isEnabled = (id: number) => {
    if (!enabledRuleIds.includes(id)) return false;
    if (chartPart === 'sub') {
      // 副图只允许规则 1 (超差)、规则 2 (同侧)、规则 3 (单调递增递减)
      return [1, 2, 3].includes(id);
    }
    return true;
  };

  for (let i = 0; i < evaluated.length; i++) {
    const val = values[i];
    
    // 规则 1: 1点落在 3σ 区外 (超出 UCL 或低于 LCL)
    if (isEnabled(1)) {
      if (val > ucl || val < lcl) {
        evaluated[i].violations.push({
          ruleId: 1,
          ruleName: '规则 1: 点落在3σ区外',
          chartPart,
          description: `该点值 (${val.toFixed(4)}) 超出控制限 [${lcl.toFixed(4)}, ${ucl.toFixed(4)}]`
        });
      }
    }

    // 规则 2: 连续 9 点在中心线同侧
    if (isEnabled(2) && i >= 8) {
      let sameSideUpper = true;
      let sameSideLower = true;
      for (let j = i - 8; j <= i; j++) {
        if (values[j] <= cl) sameSideUpper = false;
        if (values[j] >= cl) sameSideLower = false;
      }
      if (sameSideUpper || sameSideLower) {
        evaluated[i].violations.push({
          ruleId: 2,
          ruleName: '规则 2: 连续9点在中心线同侧',
          chartPart,
          description: `连续9个子组全部位于中心线 ${sameSideUpper ? '上方' : '下方'}`
        });
      }
    }

    // 规则 3: 连续 6 点单调递增或递减
    if (isEnabled(3) && i >= 5) {
      let increasing = true;
      let decreasing = true;
      for (let j = i - 4; j <= i; j++) {
        if (values[j] <= values[j - 1]) increasing = false;
        if (values[j] >= values[j - 1]) decreasing = false;
      }
      if (increasing || decreasing) {
        evaluated[i].violations.push({
          ruleId: 3,
          ruleName: '规则 3: 连续6点递增或递减',
          chartPart,
          description: `连续6个子组呈现单调${increasing ? '递增' : '递减'}趋势`
        });
      }
    }

    // 规则 4: 连续 14 点交替上下
    if (isEnabled(4) && i >= 13) {
      let alternating = true;
      for (let j = i - 12; j <= i; j++) {
        const diffCurrent = values[j] - values[j - 1];
        const diffPrev = values[j - 1] - values[j - 2];
        if ((diffCurrent > 0 && diffPrev > 0) || (diffCurrent < 0 && diffPrev < 0) || diffCurrent === 0) {
          alternating = false;
          break;
        }
      }
      if (alternating) {
        evaluated[i].violations.push({
          ruleId: 4,
          ruleName: '规则 4: 连续14点交替上下',
          chartPart,
          description: '连续14个子组呈现明显的锯齿状上下交替波动'
        });
      }
    }

    // 规则 5: 连续 3 点中有 2 点在 2σ 以外同侧 (Zone A 或超出)
    if (isEnabled(5) && i >= 2) {
      const window = [values[i - 2], values[i - 1], values[i]];
      const upperZoneACount = window.filter(v => v > cl + 2 * sigma).length;
      const lowerZoneACount = window.filter(v => v < cl - 2 * sigma).length;
      if (upperZoneACount >= 2 || lowerZoneACount >= 2) {
        evaluated[i].violations.push({
          ruleId: 5,
          ruleName: '规则 5: 连续3点中有2点在2σ以外同侧',
          chartPart,
          description: `近3个点中有${Math.max(upperZoneACount, lowerZoneACount)}个点超出 2σ 区域`
        });
      }
    }

    // 规则 6: 连续 5 点中有 4 点在 1σ 以外同侧 (Zone B 及以上)
    if (isEnabled(6) && i >= 4) {
      const window = [values[i - 4], values[i - 3], values[i - 2], values[i - 1], values[i]];
      const upperZoneBCount = window.filter(v => v > cl + 1 * sigma).length;
      const lowerZoneBCount = window.filter(v => v < cl - 1 * sigma).length;
      if (upperZoneBCount >= 4 || lowerZoneBCount >= 4) {
        evaluated[i].violations.push({
          ruleId: 6,
          ruleName: '规则 6: 连续5点中有4点在1σ以外同侧',
          chartPart,
          description: `近5个点中有${Math.max(upperZoneBCount, lowerZoneBCount)}个点超出 1σ 区域`
        });
      }
    }

    // 规则 7: 连续 15 点落在 1σ 以内 (Zone C 内，虚假受控)
    if (isEnabled(7) && i >= 14) {
      let allInZoneC = true;
      for (let j = i - 14; j <= i; j++) {
        if (Math.abs(values[j] - cl) > 1 * sigma) {
          allInZoneC = false;
          break;
        }
      }
      if (allInZoneC) {
        evaluated[i].violations.push({
          ruleId: 7,
          ruleName: '规则 7: 连续15点落在1σ以内',
          chartPart,
          description: '连续15个子组全部落在中心线 1σ 内部 (虚假受控/变异不足)'
        });
      }
    }

    // 规则 8: 连续 8 点在 1σ 以外两侧无一在 1σ 内 (双峰/混流)
    if (isEnabled(8) && i >= 7) {
      let noneInZoneC = true;
      for (let j = i - 7; j <= i; j++) {
        if (Math.abs(values[j] - cl) <= 1 * sigma) {
          noneInZoneC = false;
          break;
        }
      }
      if (noneInZoneC) {
        evaluated[i].violations.push({
          ruleId: 8,
          ruleName: '规则 8: 连续8点在1σ以外两侧无一在1σ内',
          chartPart,
          description: '连续8个子组均位于 1σ 区域外部 (可能存在双峰混合分布)'
        });
      }
    }
  }

  return evaluated;
}

/**
 * 过程能力指数计算 (Cp, Cpk, Pp, Ppk)
 */
export function calculateProcessCapability(
  subgroups: SubgroupDataPoint[],
  limits: ControlLimits,
  usl?: number,
  sl?: number,
  lsl?: number
): ProcessCapability {
  const activeSubgroups = subgroups.filter(sg => !sg.isVoided);
  if (activeSubgroups.length === 0) {
    return {
      mean: 0,
      sigmaWithin: 0,
      sigmaOverall: 0,
      grade: 'D',
      gradeDesc: '无有效数据'
    };
  }

  const allValues: number[] = [];
  activeSubgroups.forEach(sg => {
    if (sg.values && sg.values.length > 0) {
      allValues.push(...sg.values);
    } else {
      allValues.push(sg.mean);
    }
  });

  const totalN = allValues.length;
  const grandMean = allValues.reduce((a, b) => a + b, 0) / totalN;

  const sumSq = allValues.reduce((acc, val) => acc + Math.pow(val - grandMean, 2), 0);
  const sigmaOverall = totalN > 1 ? Math.sqrt(sumSq / (totalN - 1)) : 0;
  const sigmaWithin = limits.sigma > 0 ? limits.sigma : sigmaOverall;

  let cp: number | undefined;
  let cpk: number | undefined;
  let cpu: number | undefined;
  let cpl: number | undefined;
  
  let pp: number | undefined;
  let ppk: number | undefined;
  let ppu: number | undefined;
  let ppl: number | undefined;
  let ca: number | undefined;

  const hasUSL = usl !== undefined && !isNaN(usl);
  const hasLSL = lsl !== undefined && !isNaN(lsl);

  if (hasUSL && hasLSL && usl! > lsl!) {
    const specWidth = usl! - lsl!;
    if (sigmaWithin > 0) {
      cp = specWidth / (6 * sigmaWithin);
      cpu = (usl! - grandMean) / (3 * sigmaWithin);
      cpl = (grandMean - lsl!) / (3 * sigmaWithin);
      cpk = Math.min(cpu, cpl);
    }
    if (sigmaOverall > 0) {
      pp = specWidth / (6 * sigmaOverall);
      ppu = (usl! - grandMean) / (3 * sigmaOverall);
      ppl = (grandMean - lsl!) / (3 * sigmaOverall);
      ppk = Math.min(ppu, ppl);
    }
    const targetSL = sl !== undefined ? sl : (usl! + lsl!) / 2;
    ca = Math.abs(grandMean - targetSL) / (specWidth / 2);
  } else if (hasUSL) {
    if (sigmaWithin > 0) {
      cpu = (usl! - grandMean) / (3 * sigmaWithin);
      cpk = cpu;
    }
    if (sigmaOverall > 0) {
      ppu = (usl! - grandMean) / (3 * sigmaOverall);
      ppk = ppu;
    }
  } else if (hasLSL) {
    if (sigmaWithin > 0) {
      cpl = (grandMean - lsl!) / (3 * sigmaWithin);
      cpk = cpl;
    }
    if (sigmaOverall > 0) {
      ppl = (grandMean - lsl!) / (3 * sigmaOverall);
      ppk = ppl;
    }
  }

  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'B';
  let gradeDesc = '制程能力合格';
  const evalIndex = cpk ?? ppk ?? 1.0;

  if (evalIndex >= 1.67) {
    grade = 'A+';
    gradeDesc = '极充裕 - 制程能力特优，不良率 < 1 PPM';
  } else if (evalIndex >= 1.33) {
    grade = 'A';
    gradeDesc = '充裕 - 制程能力良好，稳定受控';
  } else if (evalIndex >= 1.0) {
    grade = 'B';
    gradeDesc = '临界合格 - 需加强维护与趋势监控';
  } else if (evalIndex >= 0.67) {
    grade = 'C';
    gradeDesc = '不足 - 波动较大，存在超差风险';
  } else {
    grade = 'D';
    gradeDesc = '严重不足 - 制程失控，急需停机整改';
  }

  let ppm = 0;
  if (cpk !== undefined) {
    const z = Math.max(0, cpk * 3);
    const p = Math.exp(-0.5 * z * z) / (z * Math.sqrt(2 * Math.PI));
    ppm = Math.round(p * 1_000_000);
  }

  return {
    mean: Number(grandMean.toFixed(4)),
    sigmaWithin: Number(sigmaWithin.toFixed(4)),
    sigmaOverall: Number(sigmaOverall.toFixed(4)),
    cp: cp !== undefined ? Number(cp.toFixed(3)) : undefined,
    cpk: cpk !== undefined ? Number(cpk.toFixed(3)) : undefined,
    cpu: cpu !== undefined ? Number(cpu.toFixed(3)) : undefined,
    cpl: cpl !== undefined ? Number(cpl.toFixed(3)) : undefined,
    pp: pp !== undefined ? Number(pp.toFixed(3)) : undefined,
    ppk: ppk !== undefined ? Number(ppk.toFixed(3)) : undefined,
    ppl: ppl !== undefined ? Number(ppl.toFixed(3)) : undefined,
    ppu: ppu !== undefined ? Number(ppu.toFixed(3)) : undefined,
    ca: ca !== undefined ? Number(ca.toFixed(3)) : undefined,
    grade,
    gradeDesc,
    ppm
  };
}

/**
 * 正态分布概率密度函数
 */
export function normalPdf(x: number, mean: number, sigma: number): number {
  if (sigma <= 0) return 0;
  const factor = 1 / (sigma * Math.sqrt(2 * Math.PI));
  const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(sigma, 2));
  return factor * Math.exp(exponent);
}

/**
 * 审查审计模式数据模拟生成算法
 */
export function generateAuditSimulationSubgroups(
  realSubgroups: SubgroupDataPoint[],
  chartType: SPCChartType,
  mode: 'cn' | 'gjb',
  params: {
    targetCpk: number;
    usl: number;
    sl: number;
    lsl: number;
    ucl?: number;
    cl?: number;
    lcl?: number;
  }
): SubgroupDataPoint[] {
  if (!realSubgroups || realSubgroups.length === 0) return [];

  const { targetCpk, usl, sl, lsl, ucl, cl, lcl } = params;
  
  const targetMean = sl !== undefined && !isNaN(sl) ? sl : (cl !== undefined && !isNaN(cl) ? cl : (usl + lsl) / 2);
  const specTolerance = Math.abs(usl - lsl) || 1;
  const offset = Math.abs(targetMean - (usl + lsl) / 2);
  const effectiveMargin = Math.max(0.0001, (specTolerance / 2) - offset);
  const targetSigma = effectiveMargin / (3 * Math.max(0.1, targetCpk));

  const isVariable = ['xbar-r', 'xbar-s', 'i-mr'].includes(chartType);
  const isIndividual = chartType === 'i-mr';

  const simulated: SubgroupDataPoint[] = realSubgroups.map((real, idx) => {
    const n = Math.max(1, real.n || (real.values?.length || 5));
    const newValues: number[] = [];

    const wave = Math.sin((idx * 1.3)) * 0.4 + Math.cos((idx * 0.7)) * 0.25;
    const batchMean = targetMean + wave * (targetSigma * 0.35);

    if (isIndividual) {
      const v = Number(batchMean.toFixed(4));
      newValues.push(v);
    } else if (isVariable) {
      for (let j = 0; j < n; j++) {
        const subAngle = (j / n) * Math.PI * 2;
        const subNoise = (Math.sin(subAngle + idx) * 0.7 + (Math.random() - 0.5) * 0.3);
        const val = batchMean + subNoise * targetSigma;
        newValues.push(Number(val.toFixed(4)));
      }
    }

    const stats = computeSubgroupStats(newValues);
    
    let sampleCount = real.sampleCount ?? n ?? 100;
    let defectCount = 0;
    let computedMean = stats.mean;

    if (chartType === 'p') {
      const targetP = mode === 'gjb' ? 0.003 : 0.008;
      defectCount = Math.max(0, Math.round(sampleCount * (targetP + (Math.random() - 0.5) * 0.002)));
      computedMean = Number((defectCount / sampleCount).toFixed(4));
    } else if (chartType === 'np') {
      defectCount = mode === 'gjb' ? 1 : 2;
      computedMean = defectCount;
    } else if (chartType === 'c') {
      defectCount = mode === 'gjb' ? 2 : 4;
      computedMean = defectCount;
    } else if (chartType === 'u') {
      defectCount = mode === 'gjb' ? 2 : 3;
      computedMean = Number((defectCount / sampleCount).toFixed(4));
    }

    return {
      id: `sim-${real.id}`,
      seq: real.seq,
      sampleTime: real.sampleTime,
      batchNo: real.batchNo,
      processName: real.processName,
      deviceNo: real.deviceNo,
      operator: real.operator,
      values: newValues,
      sampleCount,
      defectCount,
      n,
      mean: Number(computedMean.toFixed(4)),
      range: Number(stats.range.toFixed(4)),
      stdDev: Number(stats.stdDev.toFixed(4)),
      isVoided: false,
      violations: []
    };
  });

  if (chartType === 'i-mr') {
    for (let i = 1; i < simulated.length; i++) {
      simulated[i].movingRange = Number(Math.abs(simulated[i].mean - simulated[i - 1].mean).toFixed(4));
    }
  }

  return simulated;
}