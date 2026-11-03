import { Table, Column, Model, DataType, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import { VOTE_VALUES, type VoteValue } from './constants'
import { Report } from './Report'
import { User } from './User'

/** "Clap" de la comunidad: un voto por usuario por reporte */
@Table({
  tableName: 'report_votes',
  indexes: [{ unique: true, fields: ['reportId', 'userId'] }],
})
export class ReportVote extends Model {
  @AllowNull(false)
  @Column(DataType.ENUM(...VOTE_VALUES))
  declare value: VoteValue

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

  @BelongsTo(() => User, { onDelete: 'CASCADE' })
  declare user: User
}
