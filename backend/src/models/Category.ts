import { Table, Column, Model, DataType, AllowNull, Unique, HasMany, ForeignKey, BelongsTo } from 'sequelize-typescript'
import { Report } from './Report'
import { Area } from './Area'

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

  /** Área responsable por defecto: los reportes nuevos se le asignan automáticamente */
  @ForeignKey(() => Area)
  @Column(DataType.INTEGER)
  declare areaId: number | null

  @BelongsTo(() => Area, { onDelete: 'SET NULL' })
  declare area: Area | null

  @HasMany(() => Report)
  declare reports: Report[]
}
