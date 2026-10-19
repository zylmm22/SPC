/**
 * Excel 模板生成与解析工具 (基于 xlsx 库)
 * 支持用户自定义模板搭建、一键下载标准 Excel 模板、解析导入并按生产批号聚合为子组
 */

import * as XLSX from 'xlsx';
import { SubgroupDataPoint, SPCChartType, ProcessCharacteristic } from '../types/spc';
import { computeSubgroupStats } from './spcEngine';

export interface TemplateBuilderConfig {
  templateTitle: string;
  chartType: SPCChartType;
  processName: string;
  deviceNo: string;
  sampleSize: number;           // 每个批次抽样数 n
  unit: string;
  includeInspector: boolean;
  notes?: string;
}

/**
 * 动态生成并下载 Excel 模板
 */
export function downloadExcelTemplate(config: TemplateBuilderConfig) {
  const wb = XLSX.utils.book_new();

  const isVariable = ['xbar-r', 'xbar-s', 'i-mr'].includes(config.chartType);
  const isIndividual = config.chartType === 'i-mr';
  const isAttribute = !isVariable;

  // 构建表头行
  const headers: string[] = ['序号', '采集时间', '生产批号', '工序', '设备号'];

  if (config.includeInspector) {
    headers.push('检验员');
  }

  if (isIndividual) {
    headers.push(`单值测量点(${config.unit || '数值'})`);
  } else if (isVariable) {
    for (let i = 1; i <= config.sampleSize; i++) {
      headers.push(`测量值 x${i}(${config.unit || '数值'})`);
    }
  } else if (config.chartType === 'p' || config.chartType === 'u') {
    headers.push('抽样总数(n)');
    headers.push(config.chartType === 'p' ? '不合格品数(d)' : '缺陷数(c)');
  } else {
    // np, c
    headers.push(config.chartType === 'np' ? '不合格品数(d)' : '缺陷数(c)');
  }

  // 预置2条示例数据
  const now = new Date();
  const sampleRows: any[] = [];
  
  for (let rowIdx = 1; rowIdx <= 3; rowIdx++) {
    const timeStr = new Date(now.getTime() - (3 - rowIdx) * 3600000).toISOString().replace('T', ' ').substring(0, 19);
    const batchStr = `LOT-${new Date().toISOString().substring(2, 10).replace(/-/g, '')}-${String(rowIdx).padStart(3, '0')}`;
    
    const rowObj: any = {
      '序号': rowIdx,
      '采集时间': timeStr,
      '生产批号': batchStr,
      '工序': config.processName || '精加工工序',
      '设备号': config.deviceNo || `CNC-0${rowIdx}`
    };

    if (config.includeInspector) {
      rowObj['检验员'] = 'QC-01';
    }

    if (isIndividual) {
      rowObj[`单值测量点(${config.unit || '数值'})`] = Number((10.0 + (Math.random() - 0.5) * 0.2).toFixed(3));
    } else if (isVariable) {
      for (let i = 1; i <= config.sampleSize; i++) {
        rowObj[`测量值 x${i}(${config.unit || '数值'})`] = Number((10.0 + (Math.random() - 0.5) * 0.15).toFixed(3));
      }
    } else if (config.chartType === 'p' || config.chartType === 'u') {
      rowObj['抽样总数(n)'] = 100;
      rowObj[config.chartType === 'p' ? '不合格品数(d)' : '缺陷数(c)'] = Math.floor(Math.random() * 4);
    } else {
      rowObj[config.chartType === 'np' ? '不合格品数(d)' : '缺陷数(c)'] = Math.floor(Math.random() * 5);
    }

    sampleRows.push(rowObj);
  }

  const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });

  // 设置列宽
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length * 2.5, 14) }));

  XLSX.utils.book_append_sheet(wb, ws, 'SPC数据录入模板');

  // 生成文件名
  const filename = `SPC_${config.chartType.toUpperCase()}_数据录入模板_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * 解析用户上传的 Excel / CSV 文件
 * 核心逻辑：按照生产批号 (batchNo) 进行聚合子组！
 */
export async function parseUploadedExcel(
  file: File,
  characteristic: ProcessCharacteristic
): Promise<{ subgroups: SubgroupDataPoint[]; summary: { totalRows: number; totalBatches: number; errors: string[] } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 转换为 JSON 对象数组
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (!rawJson || rawJson.length === 0) {
          throw new Error('Excel 文件中没有检测到有效数据行');
        }

        const errors: string[] = [];
        
        // 智能匹配字段名
        const findField = (row: any, candidates: string[]) => {
          for (const key of Object.keys(row)) {
            const cleanKey = key.trim().toLowerCase();
            if (candidates.some(c => cleanKey.includes(c.toLowerCase()))) {
              return row[key];
            }
          }
          return undefined;
        };

        // 按生产批号聚合的 Map
        const batchMap = new Map<string, {
          seq: number;
          sampleTime: string;
          batchNo: string;
          processName: string;
          deviceNo: string;
          operator?: string;
          values: number[];
          sampleCounts: number[];
          defectCounts: number[];
        }>();

        rawJson.forEach((row, idx) => {
          const rawBatch = findField(row, ['生产批号', '批号', 'batch', 'lot', 'batchno']);
          const batchNo = rawBatch ? String(rawBatch).trim() : `LOT-AUTO-${String(idx + 1).padStart(3, '0')}`;
          
          const rawTime = findField(row, ['采集时间', '时间', '抽检时间', '日期', 'time', 'date']);
          const sampleTime = rawTime ? String(rawTime).trim() : new Date().toISOString().replace('T', ' ').substring(0, 19);
          
          const rawProcess = findField(row, ['工序', '工序名称', 'process']);
          const processName = rawProcess ? String(rawProcess).trim() : characteristic.processName;
          
          const rawDevice = findField(row, ['设备号', '设备', '机台', 'device', 'machine']);
          const deviceNo = rawDevice ? String(rawDevice).trim() : 'M-01';

          const rawOperator = findField(row, ['检验员', '操作员', 'operator', 'qc']);

          // 提取数值
          const rowValues: number[] = [];
          let rowSampleCount: number | undefined = undefined;
          let rowDefectCount: number | undefined = undefined;

          // 查找测量值列 x1, x2, ... 或包含 "测量" / "值" / "value" 的列
          Object.keys(row).forEach(key => {
            const lower = key.trim().toLowerCase();
            if (
              lower.startsWith('x') || 
              lower.includes('测量') || 
              lower.includes('单值') || 
              lower.includes('点') ||
              lower.includes('value') ||
              lower.includes('val')
            ) {
              const val = parseFloat(row[key]);
              if (!isNaN(val)) {
                rowValues.push(val);
              }
            } else if (lower.includes('抽样') || lower.includes('样本数') || lower.includes('总数') || lower === 'n') {
              const cnt = parseInt(row[key], 10);
              if (!isNaN(cnt)) rowSampleCount = cnt;
            } else if (lower.includes('不良') || lower.includes('缺陷') || lower.includes('不合格') || lower === 'd' || lower === 'c') {
              const def = parseInt(row[key], 10);
              if (!isNaN(def)) rowDefectCount = def;
            }
          });

          // 如果没有按列匹配到，尝试查找任意未被识别为批号/时间/工序的数字列
          if (rowValues.length === 0 && rowSampleCount === undefined && rowDefectCount === undefined) {
            Object.keys(row).forEach(key => {
              const lower = key.trim().toLowerCase();
              if (
                !lower.includes('批') && 
                !lower.includes('时') && 
                !lower.includes('日') && 
                !lower.includes('序') && 
                !lower.includes('备') && 
                !lower.includes('员') &&
                !lower.includes('序号')
              ) {
                const val = parseFloat(row[key]);
                if (!isNaN(val)) {
                  rowValues.push(val);
                }
              }
            });
          }

          if (!batchMap.has(batchNo)) {
            batchMap.set(batchNo, {
              seq: batchMap.size + 1,
              sampleTime,
              batchNo,
              processName,
              deviceNo,
              operator: rawOperator ? String(rawOperator) : undefined,
              values: [],
              sampleCounts: [],
              defectCounts: []
            });
          }

          const entry = batchMap.get(batchNo)!;
          if (rowValues.length > 0) {
            entry.values.push(...rowValues);
          }
          if (rowSampleCount !== undefined) {
            entry.sampleCounts.push(rowSampleCount);
          }
          if (rowDefectCount !== undefined) {
            entry.defectCounts.push(rowDefectCount);
          }
        });

        // 将批次聚合成子组数据点 SubgroupDataPoint[]
        const subgroups: SubgroupDataPoint[] = [];
        let seq = 1;

        batchMap.forEach((batchData, batchNo) => {
          let statsMean = 0;
          let statsRange = 0;
          let statsStdDev = 0;
          let n = batchData.values.length;
          let sampleCount = batchData.sampleCounts.reduce((a, b) => a + b, 0) || characteristic.sampleSize || 100;
          let defectCount = batchData.defectCounts.reduce((a, b) => a + b, 0);

          if (['xbar-r', 'xbar-s', 'i-mr'].includes(characteristic.chartType)) {
            if (batchData.values.length > 0) {
              const stats = computeSubgroupStats(batchData.values);
              statsMean = stats.mean;
              statsRange = stats.range;
              statsStdDev = stats.stdDev;
              n = stats.n;
            }
          } else if (characteristic.chartType === 'p') {
            statsMean = sampleCount > 0 ? defectCount / sampleCount : 0;
          } else if (characteristic.chartType === 'np') {
            statsMean = defectCount;
          } else if (characteristic.chartType === 'c') {
            statsMean = defectCount;
          } else if (characteristic.chartType === 'u') {
            statsMean = sampleCount > 0 ? defectCount / sampleCount : 0;
          }

          subgroups.push({
            id: `sg-${Date.now()}-${seq}`,
            seq: seq++,
            sampleTime: batchData.sampleTime,
            batchNo,
            processName: batchData.processName,
            deviceNo: batchData.deviceNo,
            operator: batchData.operator,
            values: batchData.values,
            n: n || characteristic.sampleSize || 5,
            mean: Number(statsMean.toFixed(4)),
            range: Number(statsRange.toFixed(4)),
            stdDev: Number(statsStdDev.toFixed(4)),
            sampleCount,
            defectCount,
            isVoided: false,
            violations: []
          });
        });

        resolve({
          subgroups,
          summary: {
            totalRows: rawJson.length,
            totalBatches: batchMap.size,
            errors
          }
        });

      } catch (err: any) {
        reject(new Error(`解析 Excel 失败: ${err.message || '文件格式不正确'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('读取文件异常，请重新选择'));
    };

    reader.readAsArrayBuffer(file);
  });
}
