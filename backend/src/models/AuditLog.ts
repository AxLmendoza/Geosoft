import { Table, Column, Model, DataType, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import { User } from './User'

/**
 * Registro de auditoría de acciones administrativas (alta de personal, cambios de rol,
 * activación, reasignaciones, configuración...). Solo se agregan filas: nunca se editan.
 * `details` jamás contiene contraseñas, tokens ni códigos.
 */
@Table({ tableName: 'audit_logs', updatedAt: false })
export class AuditLog extends Model {
  /** Quién hizo la acción (null = sistema o usuario eliminado) */
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  declare actorId: number | null

  @BelongsTo(() => User, { foreignKey: 'actorId', as: 'actor', onDelete: 'SET NULL' })
  declare actor: User | null

  /** p. ej. staff.created, staff.deactivated, report.assigned */
  @AllowNull(false)
  @Column(DataType.STRING(40))
  declare action: string

  /** user | report | area | category | blacklist */
  @AllowNull(false)
  @Column(DataType.STRING(20))
  declare targetType: string

  @Column(DataType.INTEGER)
  declare targetId: number | null

  @Column(DataType.JSONB)
  declare details: Record<string, unknown> | null

  @Column(DataType.STRING(45))
  declare ip: string | null
}
