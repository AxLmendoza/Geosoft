import {
  Table, Column, Model, DataType, Default, Unique, AllowNull, HasMany, DefaultScope, Scopes, ForeignKey, BelongsTo,
} from 'sequelize-typescript'
import { ROLES, type Role } from './constants'
import { Report } from './Report'
import { Area } from './Area'

@DefaultScope(() => ({
  attributes: { exclude: ['password', 'token', 'tokenExpiresAt', 'inviteTokenHash'] },
}))
@Scopes(() => ({
  withSecrets: { attributes: { include: ['password', 'token', 'tokenExpiresAt', 'inviteTokenHash'] } },
}))
@Table({ tableName: 'users' })
export class User extends Model {
  @AllowNull(false)
  @Column(DataType.STRING(60))
  declare name: string

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(120))
  declare email: string

  @AllowNull(false)
  @Column(DataType.STRING(72))
  declare password: string

  @Default('ciudadano')
  @Column(DataType.ENUM(...ROLES))
  declare role: Role

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare confirmed: boolean

  /** Código de 6 dígitos (confirmación de cuenta o reset de password) */
  @Column(DataType.STRING(6))
  declare token: string | null

  @Column(DataType.DATE)
  declare tokenExpiresAt: Date | null

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare banned: boolean

  @Column(DataType.STRING(300))
  declare bannedReason: string | null

  @Column(DataType.DATE)
  declare bannedAt: Date | null

  /** Área a la que pertenece el personal operativo */
  @ForeignKey(() => Area)
  @Column(DataType.INTEGER)
  declare areaId: number | null

  @BelongsTo(() => Area, { onDelete: 'SET NULL' })
  declare area: Area | null

  /**
   * Cuenta habilitada. Desactivar NO borra al usuario ni su historial:
   * solo impide iniciar sesión y usar la API (se revisa en cada petición).
   * Es distinto de `banned`, que es una sanción de moderación.
   */
  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  declare active: boolean

  @Column(DataType.DATE)
  declare lastLoginAt: Date | null

  /**
   * Invitación del personal: solo se guarda el hash SHA-256 del enlace (nunca el token).
   * null cuando la invitación ya se aceptó o se invalidó.
   */
  @Column(DataType.STRING(64))
  declare inviteTokenHash: string | null

  @Column(DataType.DATE)
  declare inviteExpiresAt: Date | null

  /** Fecha de la última invitación enviada (se conserva al aceptarla) */
  @Column(DataType.DATE)
  declare invitedAt: Date | null

  /** Administrador que dio de alta la cuenta (null = registro propio) */
  @Column(DataType.INTEGER)
  declare invitedById: number | null

  @HasMany(() => Report)
  declare reports: Report[]
}
