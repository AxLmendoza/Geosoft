import { Table, Column, Model, DataType, AllowNull, Default, ForeignKey, BelongsTo } from 'sequelize-typescript'
import { HISTORY_KINDS, REPORT_STATUS, type HistoryKind, type ReportStatus } from './constants'
import { Report } from './Report'
import { User } from './User'
import { Area } from './Area'

/**
 * Seguimiento: cada movimiento de un reporte (cambio de estado, asignación de área,
 * observación, evidencia del personal o información adicional del ciudadano).
 * Guarda fecha/hora (createdAt) y el usuario responsable (changedById).
 */
@Table({ tableName: 'report_history', updatedAt: false })
export class ReportHistory extends Model {
  /** STRING (no ENUM) para no crear tipos nuevos en Postgres. Los registros antiguos son 'estado' */
  @AllowNull(false)
  @Default('estado')
  @Column({ type: DataType.STRING(20), validate: { isIn: [HISTORY_KINDS as unknown as string[]] } })
  declare kind: HistoryKind

  @Column(DataType.ENUM(...REPORT_STATUS))
  declare fromStatus: ReportStatus | null

  /** Estado del reporte después del movimiento (en notas/evidencias es el estado vigente) */
  @AllowNull(false)
  @Column(DataType.ENUM(...REPORT_STATUS))
  declare toStatus: ReportStatus

  @Column(DataType.STRING(600))
  declare note: string | null

  /** Nota interna: solo la ve el personal (admin, moderación y el área responsable) */
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare internal: boolean

  /** Evidencia fotográfica adjunta (opcional) */
  @Column(DataType.STRING(255))
  declare imageUrl: string | null

  @Column(DataType.STRING(255))
  declare thumbUrl: string | null

  @ForeignKey(() => Area)
  @Column(DataType.INTEGER)
  declare fromAreaId: number | null

  @BelongsTo(() => Area, { foreignKey: 'fromAreaId', as: 'fromArea', onDelete: 'SET NULL' })
  declare fromArea: Area | null

  @ForeignKey(() => Area)
  @Column(DataType.INTEGER)
  declare toAreaId: number | null

  @BelongsTo(() => Area, { foreignKey: 'toAreaId', as: 'toArea', onDelete: 'SET NULL' })
  declare toArea: Area | null

  @ForeignKey(() => Report)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare reportId: number

  @BelongsTo(() => Report, { onDelete: 'CASCADE' })
  declare report: Report

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  declare changedById: number | null

  @BelongsTo(() => User, { foreignKey: 'changedById', as: 'changedBy', onDelete: 'SET NULL' })
  declare changedBy: User | null
}
