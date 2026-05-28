import { AreaPlugin } from 'rete-area-plugin'
import { NodeEditor, type GetSchemes, ClassicPreset } from 'rete'
import { LitPlugin, Presets, type LitArea2D } from '@retejs/lit-plugin'

type Schemes = GetSchemes<
  ClassicPreset.Node,
  ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>
>
type AreaExtra = LitArea2D<Schemes>

export type BasicEditorHandle = {
  destroy: () => void
}

export async function createBasicEditor(
  container: HTMLElement,
): Promise<BasicEditorHandle> {
  const editor = new NodeEditor<Schemes>()
  const area = new AreaPlugin<Schemes, AreaExtra>(container)
  const render = new LitPlugin<Schemes, AreaExtra>()

  render.addPreset(Presets.classic.setup())

  editor.use(area)
  area.use(render)

  const socket = new ClassicPreset.Socket('any')

  const node1 = new ClassicPreset.Node('Node 1')
  node1.addOutput('out', new ClassicPreset.Output(socket, 'out'))

  const node2 = new ClassicPreset.Node('Node 2')
  node2.addInput('in', new ClassicPreset.Input(socket, 'in'))

  await editor.addNode(node1)
  await editor.addNode(node2)

  await area.translate(node1.id, { x: 80, y: 80 })
  await area.translate(node2.id, { x: 360, y: 80 })

  await editor.addConnection(
    new ClassicPreset.Connection(node1, 'out', node2, 'in'),
  )

  return {
    destroy() {
      // 破棄APIが提供される場合は優先して使う（メモリリーク防止）
      ;(area as unknown as { destroy?: () => void }).destroy?.()
      ;(render as unknown as { destroy?: () => void }).destroy?.()
      ;(editor as unknown as { destroy?: () => void }).destroy?.()

      container.replaceChildren()
    },
  }
}

