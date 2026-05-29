import { ClassicPreset, type GetSchemes } from 'rete'

/** ノード種別（シリアライザで label に依存しない判別用） */
export type NodeKind = 'viewSchema' | 'entityField' | 'viewField'

export const fieldSocket = new ClassicPreset.Socket('field')

/** Entity フィールド（マッピング用） */
export class EntityFieldNode extends ClassicPreset.Node {
  readonly kind: NodeKind = 'entityField'

  constructor(fieldName: string, displayName?: string) {
    const label = displayName?.trim() || fieldName
    super(`EntityField: ${label}`)
    this.data = { fieldName, displayName: displayName?.trim() || undefined }
    this.addOutput('value', new ClassicPreset.Output(fieldSocket, 'value'))
  }

  data: {
    fieldName: string
    displayName?: string
  }
}

/** View 出力フィールド（マッピング用） */
export class ViewFieldNode extends ClassicPreset.Node {
  readonly kind: NodeKind = 'viewField'
  /** rete-area / lit-plugin がノード幅として参照（高さは control 内容に任せる） */
  width = 248

  constructor(viewFieldId: string) {
    super('ViewField')
    this.data = { viewFieldId }
    this.addInput('in', new ClassicPreset.Input(fieldSocket, 'in'))
  }

  data: {
    viewFieldId: string
  }
}

export type MappingNode = EntityFieldNode | ViewFieldNode

/** lit-plugin の classic preset と互換させるため Node は ClassicPreset.Node を使用 */
export type Schemes = GetSchemes<
  ClassicPreset.Node,
  ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>
>

export function isEntityFieldNode(
  node: ClassicPreset.Node,
): node is EntityFieldNode {
  return node instanceof EntityFieldNode
}

export function isViewFieldNode(node: ClassicPreset.Node): node is ViewFieldNode {
  return node instanceof ViewFieldNode
}
