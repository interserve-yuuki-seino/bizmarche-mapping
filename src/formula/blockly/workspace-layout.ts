import * as Blockly from 'blockly'

const MIN_VIEW_SIZE = 32

/** コンテナサイズを Blockly に反映 */
export function resizeFormulaWorkspace(workspace: Blockly.WorkspaceSvg): void {
  Blockly.svgResize(workspace)
}

function canRelayout(workspace: Blockly.WorkspaceSvg): boolean {
  const m = workspace.getMetrics()
  return m.viewWidth >= MIN_VIEW_SIZE && m.viewHeight >= MIN_VIEW_SIZE
}

/**
 * Blockly が document.head に注入する CSS を Shadow DOM 内へ複製する。
 * Blockly の CSS は head にしか入らず Shadow 境界を越えないため、
 * これをしないと injectionDiv が `position: static` のままになり、
 * ツールボックスが全幅化・SVG が巨大化してブロックが画面外に飛ぶ。
 */
export function mirrorBlocklyStyles(root: ShadowRoot): void {
  if (root.querySelector('style[data-blockly-mirror]')) return
  for (const style of document.head.querySelectorAll('style')) {
    const text = style.textContent ?? ''
    if (!text.includes('.injectionDiv') && !text.includes('.blocklySvg')) {
      continue
    }
    const clone = document.createElement('style')
    clone.setAttribute('data-blockly-mirror', '')
    clone.textContent = text
    root.appendChild(clone)
  }
}

/**
 * Blockly のドロップダウン選択リスト（.blocklyDropDownDiv）と各種ポップアップは
 * document.body 直下に描画されるが、既定 z-index は 1000 で、数式ビルダーの
 * モーダル overlay（z-index:10000）より背面になり選択肢が隠れて見えなくなる。
 * body 直下のため Shadow DOM 内の Lit スタイルでは届かないので、head に
 * グローバル style を一度だけ注入して overlay より前面へ引き上げる。
 */
export function ensureBlocklyPopupZIndex(): void {
  const id = 'bm-blockly-popup-zindex'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  // overlay(10000) より大きい値。WidgetDiv は既定 99999 だが念のため揃える
  style.textContent =
    '.blocklyDropDownDiv,.blocklyWidgetDiv,.blocklyTooltipDiv{z-index:100001 !important;}'
  document.head.appendChild(style)
}

/** コンテナサイズ反映後にブロック群を視野中央へ（zoomToFit が中央寄せも担う） */
export function relayoutFormulaWorkspace(
  workspace: Blockly.WorkspaceSvg,
): void {
  resizeFormulaWorkspace(workspace)
  if (!canRelayout(workspace)) return

  const tops = workspace.getTopBlocks(false).filter((b) => !b.isInFlyout)
  if (tops.length === 0) {
    workspace.scrollCenter()
    return
  }

  // zoomToFit は全ブロックの外接矩形を表示領域に収め、中央へ寄せる
  workspace.zoomToFit()
}

/** 要素のレイアウト確定まで待機（モーダル表示直後のサイズ 0 対策） */
export async function waitForElementSize(
  el: HTMLElement,
  maxFrames = 24,
): Promise<void> {
  for (let i = 0; i < maxFrames; i++) {
    if (el.offsetWidth >= MIN_VIEW_SIZE && el.offsetHeight >= MIN_VIEW_SIZE) {
      return
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
}

/** 描画・接続完了後に relayout（初期表示の中央配置用） */
export function scheduleRelayoutFormulaWorkspace(
  workspace: Blockly.WorkspaceSvg,
): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        relayoutFormulaWorkspace(workspace)
      })
    })
  })
}
