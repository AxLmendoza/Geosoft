import { Table, Column, Model, DataType, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import { REPORT_STATUS, type ReportStatus } from './constants'
import { Report } from './Report'
import { User } from './User'

/** Seguimiento: cada cambio de estado de un reporte */
@Table({ tableName: 'report_history', updatedAt: false })
export class ReportHistory extends Model {
  @Column(DataType.ENUM(...REPORT_STATUS))
  declare fromStatus: ReportStatus | null

  @AllowNull(false)
  @Column(DataType.ENUM(...REPORT_STATUS))
  declare toStatus: ReportStatus

  @Column(DataType.STRING(300))
  declare note: string | null

  @ForeignKey(() => Report)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare reportId: number

  @BelongsTo(() => Report, { onDelete: 'CASCADE' })
  declare report: Report

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  declare changedById: number | null

  @BelongsTo(() => User, { onDelete: 'SET NULL' })
  declare changedBy: User | null
}
