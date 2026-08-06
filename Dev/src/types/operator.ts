/**
 * 干员数据与列配置的类型定义（数据层单一真相来源）
 *
 * 字段约定来自 resource/data_Operators.json：
 * - 数值列（hp/atk/def/res/cost/block）原始为字符串
 * - reDeploy/interval 带单位（如 "70s" / "1.3s"）
 * - Campus/Origin/Race 大小写敏感，与模糊词典 data_FuzzyItem.json 对应
 */

/** 干员数据结构 */
export interface Operator {
  name: string
  englishName?: string
  rarity?: string
  profession?: string
  hp?: string
  atk?: string
  def?: string
  res?: string
  reDeploy?: string
  cost?: string
  block?: string
  interval?: string
  position?: string
  obtain?: string
  Campus?: string
  Origin?: string
  Race?: string
  pinyinAll?: string
  pinyinFirst?: string
  [key: string]: string | undefined
}

/** 干员数据集合：中文名 → 干员 */
export type OperatorMap = Record<string, Operator>

/** 模糊分类词典：顶层键（CampusVague/OriginVague/RaceVague）→ 父类 → 成员列表 */
export interface FuzzyItemData {
  CampusVague?: Record<string, string[]>
  OriginVague?: Record<string, string[]>
  RaceVague?: Record<string, string[]>
}

/** 版本配置（resource/config_version.json） */
export interface VersionConfig {
  configVersion: number
  appVersion: string
}

/** 一条已确认的猜测记录 */
export interface GuessRow {
  name: string
  data: Operator
}

/** 猜测表列定义 */
export interface ColumnDef {
  /** data-key（沿用旧版 oper-* 命名，保持 CSS 与 tooltip 兼容） */
  key: string
  /** 表头文字 */
  label: string
  /** 是否兔头模式数值列 */
  rabbitStat: boolean
  /** 从干员数据取值 */
  get: (d: Operator) => string
}

const text = (v: unknown): string => (v === undefined || v === null ? '' : String(v))

/**
 * 13 列配置：顺序必须与表头一致
 * 前 3 项（干员/职业/位置）与兔头 7 列与模糊 3 列的渲染/对比规则由 compare.ts 消费
 */
export const COLUMNS: readonly ColumnDef[] = [
  { key: 'oper-name', label: '干员', rabbitStat: false, get: (d) => text(d.name) },
  { key: 'oper-profession', label: '职业', rabbitStat: false, get: (d) => text(d.profession) },
  { key: 'oper-hp', label: '生命', rabbitStat: true, get: (d) => text(d.hp) },
  { key: 'oper-atk', label: '攻击', rabbitStat: true, get: (d) => text(d.atk) },
  { key: 'oper-def', label: '防御', rabbitStat: true, get: (d) => text(d.def) },
  { key: 'oper-res', label: '法抗', rabbitStat: true, get: (d) => text(d.res) },
  { key: 'oper-reDeploy', label: '再部署', rabbitStat: true, get: (d) => text(d.reDeploy) },
  { key: 'oper-cost', label: '费用', rabbitStat: true, get: (d) => text(d.cost) },
  { key: 'oper-block', label: '阻挡', rabbitStat: true, get: (d) => text(d.block) },
  { key: 'oper-position', label: '位置', rabbitStat: false, get: (d) => text(d.position) },
  { key: 'oper-Campus', label: '势力', rabbitStat: false, get: (d) => text(d.Campus) },
  { key: 'oper-Origin', label: '出身地', rabbitStat: false, get: (d) => text(d.Origin) },
  { key: 'oper-Race', label: '种族', rabbitStat: false, get: (d) => text(d.Race) },
]

/** data-key → 干员数据字段名（如 oper-hp → hp），用于 tooltip 反查目标值 */
export function columnToField(key: string): string {
  return key.replace(/^oper-/, '')
}
