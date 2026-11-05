import { Table, Column, Model, DataType, AllowNull, Default, Unique, HasMany } from 'sequelize-typescript'
import { AREA_TYPES, type AreaType } from './constants'
import { Category } from './Category'
import { User } from './User'

/**
 * Área o dependencia responsable de atender un tipo de problema.
 * Se administra desde el panel (no requiere tocar código). Puede ser municipal,
 * un organismo descentralizado o una autoridad externa a la que se canaliza.
 */
@Table({ tableName: 'areas' })
export class Area extends Model {
  @AllowNull(false)
  @Column(DataType.STRING(120))
  declare name: string

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(60))
  declare slug: string

  /** STRING en lugar de ENUM para no crear tipos nuevos en Postgres */
  @AllowNull(false)
  @Default('municipal')
  @Column({ type: DataType.STRING(20), validate: { isIn: [AREA_TYPES as unknown as string[]] } })
  declare type: AreaType

  @Column(DataType.STRING(300))
  declare description: string | null

  /** Correo de contacto del área (para notificaciones vía n8n u otro servicio) */
  @Column(DataType.STRING(120))
  declare contactEmail: string | null

  /** Las áreas no se borran (tienen historial): se desactivan */
  @Default(true)
  @Column(DataType.BOOLEAN)
  declare active: boolean

  @HasMany(() => Category)
  declare categories: Category[]

  @HasMany(() => User)
  declare members: User[]
}
