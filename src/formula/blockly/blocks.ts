import * as Blockly from 'blockly'
import { FORMULA_BLOCK_TYPES } from './block-types'

export { FORMULA_BLOCK_TYPES } from './block-types'

const VALUE_OUTPUT = 'FormulaValue'
const CONDITION_OUTPUT = 'FormulaCondition'

/** ワークスペースに保存する項目名リストのキー */
export const WS_FIELD_NAMES_KEY = 'formulaFieldNames'

/** 項目名候補をブロックのドロップダウンへ反映 */
export function buildFieldOptions(
  fieldNames: string[],
  ensureValue?: string,
): [string, string][] {
  const set = new Set(fieldNames.map((n) => n.trim()).filter(Boolean))
  const ensure = ensureValue?.trim()
  if (ensure) set.add(ensure)
  const names = [...set]
  if (names.length === 0) {
    return [['(項目なし)', '']]
  }
  return names.map((n) => [n, n] as [string, string])
}

/** ドロップダウン項目 FIELD に値を安全に設定 */
export function setBlockFieldDropdown(
  block: Blockly.Block,
  value: string,
): void {
  const ws = block.workspace
  if (!ws) return
  const trimmed = value.trim()
  if (trimmed) {
    setWorkspaceFieldNames(
      ws,
      mergeFieldNames(fieldNamesFromWorkspace(ws), [trimmed]),
    )
  }
  if (trimmed) {
    const field = block.getField('FIELD')
    // 動的ドロップダウンは生成時（sourceBlock 未接続）の空選択肢をキャッシュするため、
    // 最新の項目名で選択肢を再生成してから setValue しないと検証で弾かれ値が空になる
    if (field instanceof Blockly.FieldDropdown) {
      field.getOptions(false)
    }
    block.setFieldValue(trimmed, 'FIELD')
  }
}

function mergeFieldNames(base: string[], extra: string[]): string[] {
  const set = new Set(base.map((n) => n.trim()).filter(Boolean))
  for (const n of extra) {
    if (n.trim()) set.add(n.trim())
  }
  return [...set]
}

function fieldNamesFromWorkspace(
  workspace: Blockly.Workspace,
): string[] {
  const raw = (workspace as Blockly.Workspace & { [WS_FIELD_NAMES_KEY]?: string[] })[
    WS_FIELD_NAMES_KEY
  ]
  return Array.isArray(raw) ? raw : []
}

function fieldDropdown(): Blockly.FieldDropdown {
  return new Blockly.FieldDropdown(function (this: Blockly.FieldDropdown) {
    const block = this.getSourceBlock()
    const ws = block?.workspace
    const current = String(this.getValue() ?? '')
    if (!ws) return buildFieldOptions([], current)
    return buildFieldOptions(fieldNamesFromWorkspace(ws), current)
  })
}

let blocksRegistered = false

/** Blockly ブロック定義を一度だけ登録 */
export function registerFormulaBlocks(fieldNames: string[] = []): void {
  void fieldNames
  if (blocksRegistered) return

  Blockly.common.defineBlocks({
    [FORMULA_BLOCK_TYPES.FIELD_REF]: {
      init: function (this: Blockly.Block) {
        this.appendDummyInput()
          .appendField('項目')
          .appendField(fieldDropdown(), 'FIELD')
        this.setOutput(true, VALUE_OUTPUT)
        this.setColour(160)
        this.setTooltip('Entity 項目を参照（alias 省略）')
      },
    },
    [FORMULA_BLOCK_TYPES.LITERAL_NUMBER]: {
      init: function (this: Blockly.Block) {
        this.appendDummyInput()
          .appendField('数値')
          .appendField(new Blockly.FieldNumber(0), 'NUM')
        this.setOutput(true, VALUE_OUTPUT)
        this.setColour(230)
      },
    },
    [FORMULA_BLOCK_TYPES.LITERAL_STRING]: {
      init: function (this: Blockly.Block) {
        this.appendDummyInput()
          .appendField('文字列')
          .appendField(new Blockly.FieldTextInput(''), 'TEXT')
        this.setOutput(true, VALUE_OUTPUT)
        this.setColour(230)
      },
    },
    [FORMULA_BLOCK_TYPES.CONDITION_EQ]: {
      init: function (this: Blockly.Block) {
        this.appendDummyInput().appendField(fieldDropdown(), 'FIELD')
        this.appendValueInput('RHS')
          .setCheck(VALUE_OUTPUT)
          .appendField('==')
        this.setOutput(true, CONDITION_OUTPUT)
        this.setColour(210)
        this.setInputsInline(true)
        this.setTooltip('左の「条件」からドラッグして、くぼみにはめ込みます')
      },
    },
    [FORMULA_BLOCK_TYPES.CONDITION_IN]: {
      init: function (this: Blockly.Block) {
        this.appendDummyInput()
          .appendField(fieldDropdown(), 'FIELD')
          .appendField('次のいずれか (')
        this.appendDummyInput().appendField(
          new Blockly.FieldTextInput("'1','2'"),
          'LIST',
        )
        this.appendDummyInput().appendField(')')
        this.setOutput(true, CONDITION_OUTPUT)
        this.setColour(210)
        this.setTooltip('左の「条件」からドラッグして、くぼみにはめ込みます')
      },
    },
    [FORMULA_BLOCK_TYPES.IIF]: {
      init: function (this: Blockly.Block) {
        this.appendValueInput('COND')
          .setCheck(CONDITION_OUTPUT)
          .appendField('条件分岐')
        this.appendValueInput('TRUE')
          .setCheck(VALUE_OUTPUT)
          .appendField('なら')
        this.appendValueInput('FALSE')
          .setCheck(VALUE_OUTPUT)
          .appendField('でなければ')
        this.setOutput(true, VALUE_OUTPUT)
        this.setColour(120)
        this.setTooltip(
          '条件ブロック（== / in）を COND にはめ込み、値ブロックを「なら」「でなければ」にはめ込みます',
        )
      },
    },
    [FORMULA_BLOCK_TYPES.EXPAND_NO]: {
      init: function (this: Blockly.Block) {
        this.appendValueInput('ARG0')
          .setCheck(VALUE_OUTPUT)
          .appendField('展開番号')
        this.appendValueInput('ARG1').setCheck(VALUE_OUTPUT).appendField(',')
        this.appendValueInput('ARG2').setCheck(VALUE_OUTPUT).appendField(',')
        this.setOutput(true, VALUE_OUTPUT)
        this.setColour(60)
        this.setInputsInline(true)
      },
    },
  })

  blocksRegistered = true
}

export function setWorkspaceFieldNames(
  workspace: Blockly.Workspace,
  fieldNames: string[],
): void {
  ;(workspace as Blockly.Workspace & { [WS_FIELD_NAMES_KEY]: string[] })[
    WS_FIELD_NAMES_KEY
  ] = fieldNames
}

/** ドロップダウンの項目候補を更新（既存ブロックの表示をリフレッシュ） */
export function updateFieldDropdowns(
  workspace: Blockly.Workspace,
  fieldNames: string[],
): void {
  setWorkspaceFieldNames(workspace, fieldNames)
  for (const block of workspace.getAllBlocks(false)) {
    const field = block.getField('FIELD')
    if (field instanceof Blockly.FieldDropdown) {
      field.forceRerender()
    }
  }
}

/** フェーズ1 ツールボックス XML */
export function buildToolboxXml(): string {
  return `
<xml xmlns="https://developers.google.com/blockly/xml">
  <category name="値（はめ込み）" colour="230">
    <block type="${FORMULA_BLOCK_TYPES.FIELD_REF}"></block>
    <block type="${FORMULA_BLOCK_TYPES.LITERAL_NUMBER}"></block>
    <block type="${FORMULA_BLOCK_TYPES.LITERAL_STRING}"></block>
  </category>
  <category name="条件（はめ込み）" colour="210">
    <block type="${FORMULA_BLOCK_TYPES.CONDITION_EQ}">
      <value name="RHS">
        <shadow type="${FORMULA_BLOCK_TYPES.LITERAL_NUMBER}">
          <field name="NUM">0</field>
        </shadow>
      </value>
    </block>
    <block type="${FORMULA_BLOCK_TYPES.CONDITION_IN}"></block>
  </category>
  <category name="関数（はめ込み）" colour="120">
    <block type="${FORMULA_BLOCK_TYPES.IIF}">
      <value name="COND">
        <shadow type="${FORMULA_BLOCK_TYPES.CONDITION_EQ}"></shadow>
      </value>
      <value name="TRUE">
        <shadow type="${FORMULA_BLOCK_TYPES.LITERAL_NUMBER}">
          <field name="NUM">1</field>
        </shadow>
      </value>
      <value name="FALSE">
        <shadow type="${FORMULA_BLOCK_TYPES.LITERAL_NUMBER}">
          <field name="NUM">0</field>
        </shadow>
      </value>
    </block>
    <block type="${FORMULA_BLOCK_TYPES.EXPAND_NO}">
      <value name="ARG0">
        <shadow type="${FORMULA_BLOCK_TYPES.LITERAL_STRING}"></shadow>
      </value>
      <value name="ARG1">
        <shadow type="${FORMULA_BLOCK_TYPES.LITERAL_NUMBER}">
          <field name="NUM">0</field>
        </shadow>
      </value>
      <value name="ARG2">
        <shadow type="${FORMULA_BLOCK_TYPES.LITERAL_STRING}">
          <field name="TEXT">deliveryStoreStartCd</field>
        </shadow>
      </value>
    </block>
  </category>
</xml>`
}
