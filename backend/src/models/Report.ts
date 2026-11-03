import {
  Table, Column, Model, DataType, AllowNull, Default, ForeignKey, BelongsTo, HasMany,
} from 'sequelize-typescript'
import { REPORT_STATUS, SEVERITY, type ReportStatus, type Severity } from './constants'
import { User } from './User'
import { Category } from './Category'
import { ReportFlag } from './ReportFlag'
import { ReportHistory } from './ReportHistory'
import { ReportVote } from './ReportVote'

/**
 * paranoid: true => borrado lógico. destroy() solo llena deletedAt,
 * el registro sigue en la BD para estadísticas y el PDF del admin.
 */
@Table({ tableName: 'reports', paranoid: true })
export class Report extends Model {
  @AllowNull(false)
  @Column(DataType.STRING(120))
  declare title: string

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare description: string

  /** Ruta pública de la imagen completa, ej. /uploads/reports/abc.webp */
  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare imageUrl: string

  /** Miniatura cuadrada que se muestra dentro del pin del mapa */
  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare thumbUrl: string

  @AllowNull(false)
  @Column(DataType.DECIMAL(9, 6))
  declare lat: number

  @AllowNull(false)
  @Column(DataType.DECIMAL(9, 6))
  declare lng: number

  @Column(DataType.STRING(120))
  declare colonia: string | null

  @Column(DataType.STRING(160))
  declare calle: string | null

  @Default('media')
  @Column(DataType.ENUM(...SEVERITY))
  declare severity: Severity

  @Default('pendiente')
  @Column(DataType.ENUM(...REPORT_STATUS))
  declare status: ReportStatus

  /** Si es true, solo moderadores/admin ven quién lo publicó */
  @Default(true)
  @Column(DataType.BOOLEAN)
  declare anonymous: boolean

  /** Oculto por moderación (no aparece en el mapa público) */
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare hidden: boolean

  @Column(DataType.STRING(300))
  declare hiddenReason: string | null

  /** Fecha en que pasó a "resuelto". A los N días deja de verse en el mapa público */
  @Column(DataType.DATE)
  declare resolvedAt: Date | null

  declare deletedAt: Date | null

  /** Quién hizo el borrado lógico (autor, moderador o admin) */
  @Column(DataType.INTEGER)
  declare deletedById: number | null

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare userId: number

  @BelongsTo(() => User, { onDelete: 'CASCADE' })
  declare user: User

  @ForeignKey(() => Category)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare categoryId: number

  @BelongsTo(() => Category)
  declare category: Category

  @HasMany(() => ReportFlag, { onDelete: 'CASCADE', hooks: true })
  declare flags: ReportFlag[]

  @HasMany(() => ReportHistory, { onDelete: 'CASCADE', hooks: true })
  declare history: ReportHistory[]

  @HasMany(() => ReportVote, { onDelete: 'CASCADE', hooks: true })
  declare votes: ReportVote[]
}
