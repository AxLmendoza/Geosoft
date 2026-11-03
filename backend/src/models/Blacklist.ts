import { Table, Column, Model, DataType, AllowNull, Unique, ForeignKey, BelongsTo } from 'sequelize-typescript'
import { User } from './User'

/** Correos vetados: no pueden registrarse ni iniciar sesión */
@Table({ tableName: 'blacklist' })
export class Blacklist extends Model {
  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(120))
  declare email: string

  @AllowNull(false)
  @Column(DataType.STRING(300))
  declare reason: string

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  declare createdById: number | null

  @BelongsTo(() => User, { onDelete: 'SET NULL' })
  declare createdBy: User | null
}
