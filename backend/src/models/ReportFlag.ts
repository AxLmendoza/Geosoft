import { Table, Column, Model, DataType, AllowNull, Default, ForeignKey, BelongsTo } from 'sequelize-typescript'
import { FLAG_REASONS, FLAG_STATUS, type FlagReason, type FlagStatus } from './constants'
import { Report } from './Report'
import { User } from './User'

/** Denuncia de un usuario sobre un reporte (info falsa, imagen no apta, basura...) */
@Table({ tableName: 'report_flags' })
export class ReportFlag extends Model {
  @AllowNull(false)
  @Column(DataType.ENUM(...FLAG_REASONS))
  declare reason: FlagReason

  @Column(DataType.STRING(300))
  declare comment: string | null

  @Default('pendiente')
  @Column(DataType.ENUM(...FLAG_STATUS))
  declare status: FlagStatus

  @ForeignKey(() => Report)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare reportId: number

  @BelongsTo(() => Report, { onDelete: 'CASCADE' })
  declare report: Report

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare userId: number

  @BelongsTo(() => User, { foreignKey: 'userId', as: 'reporter', onDelete: 'CASCADE' })
  declare reporter: User

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  declare reviewedById: number | null

  @BelongsTo(() => User, { foreignKey: 'reviewedById', as: 'reviewedBy', onDelete: 'SET NULL' })
  declare reviewedBy: User | null
}
