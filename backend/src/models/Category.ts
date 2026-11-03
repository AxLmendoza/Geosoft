import { Table, Column, Model, DataType, AllowNull, Unique, HasMany } from 'sequelize-typescript'
import { Report } from './Report'

@Table({ tableName: 'categories', timestamps: false })
export class Category extends Model {
  @AllowNull(false)
  @Column(DataType.STRING(60))
  declare name: string

  /** Identificador estable que el frontend usa para elegir el ícono */
  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(40))
  declare slug: string

  @AllowNull(false)
  @Column(DataType.STRING(9))
  declare color: string

  @Column(DataType.STRING(200))
  declare description: string | null

  @HasMany(() => Report)
  declare reports: Report[]
}
