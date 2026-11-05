import {
  Table, Column, Model, DataType, Default, Unique, AllowNull, HasMany, DefaultScope, Scopes, ForeignKey, BelongsTo,
} from 'sequelize-typescript'
import { ROLES, type Role } from './constants'
import { Report } from './Report'
import { Area } from './Area'

@DefaultScope(() => ({
  attributes: { exclude: ['password', 'token', 'tokenExpiresAt'] },
}))
@Scopes(() => ({
  withSecrets: { attributes: { include: ['password', 'token', 'tokenExpiresAt'] } },
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

  @HasMany(() => Report)
  declare reports: Report[]
}
