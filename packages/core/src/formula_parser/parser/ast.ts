import { Token, TokenType } from '../lexer/token';
import { IFieldMap, IReduxState } from '../../exports/store';
import { Field } from 'model';
import { BasicValueType, IField } from 'types';
import { ROLLUP_KEY_WORDS } from 'formula_parser/evaluate';
import { t, Strings } from 'i18n';

export enum AstNodeType {
  BinaryOperatorNode = 'BinaryOperatorNode',
  UnaryOperatorNode = 'UnaryOperatorNode',
  ValueOperandNode = 'ValueOperandNode',
  PureValueOperandNode = 'PureValueOperandNode',
  CallOperandNode = 'CallOperandNode',
  StringOperandNode = 'StringOperandNode',
  NumberOperandNode = 'NumberOperandNode',
}

export abstract class AstNode {
  readonly token: Token;
  readonly name!: AstNodeType;
  valueType!: BasicValueType;
  innerValueType?: BasicValueType;

  constructor(token: Token) {
    this.token = token;
  }

  toString() {
    return `AstNode: ${this.token}::${this.name}`;
  }
}

export class BinaryOperatorNode extends AstNode {
  readonly left: AstNode;
  readonly right: AstNode;
  override readonly name = AstNodeType.BinaryOperatorNode;

  constructor(left: AstNode, token: Token, right: AstNode) {
    super(token);

    this.left = left;
    this.right = right;

    // TokenType.And, TokenType.Or, TokenType.Add,
    // TokenType.Times, TokenType.Div, TokenType.Minus,
    // TokenType.Mod, TokenType.Concat,
    switch (token.type) {
    // Addition, subtraction, multiplication and division operator symbols are calculated correctly only when both sides are numbers.
      case TokenType.Add: {
        const isNumberType = ({ valueType, innerValueType, token }: AstNode) => {
          return valueType === BasicValueType.Number || innerValueType === BasicValueType.Number || token.value.toUpperCase() === 'BLANK';
        };
        if ([left, right].every(isNumberType)) {
          this.valueType = BasicValueType.Number;
          return;
        }

        this.valueType = BasicValueType.String;
        return;
      }

      case TokenType.Minus:
      case TokenType.Times:
      case TokenType.Mod:
      case TokenType.Div: {
        this.valueType = BasicValueType.Number;
        return;
      }

      case TokenType.Or:
      case TokenType.And:
      case TokenType.Equal:
      case TokenType.NotEqual:
      case TokenType.Greater:
      case TokenType.GreaterEqual:
      case TokenType.Less:
      case TokenType.LessEqual: {
        this.valueType = BasicValueType.Boolean;
        return;
      }

      case TokenType.Concat: {
        this.valueType = BasicValueType.String;
        return;
      }

      default: {
        throw new TypeError(t(Strings.function_err_unknown_operator, {
          type: token.type,
        }));
      }
    }
  }
}

export class UnaryOperatorNode extends AstNode {
  readonly child: AstNode;
  override readonly name = AstNodeType.UnaryOperatorNode;

  constructor(child: AstNode, token: Token) {
    super(token);
    this.child = child;
  }
}

export abstract class ValueOperandNodeBase extends AstNode {
  readonly value: string;
  override valueType!: BasicValueType;
  override readonly name!: AstNodeType;
  field!: IField;
  context!: { state: IReduxState, fieldMap: IFieldMap };

  constructor(token: Token) {
    super(token);
    this.value = token.value.replace(/\\(.)/g, '$1');
  }

  protected init(fieldId: string, context: { state: IReduxState, fieldMap: IFieldMap }, hostField?: IField) {
    this.context = context;
    fieldId = fieldId.replace(/\\(.)/g, '$1');
    if (fieldId === ROLLUP_KEY_WORDS && hostField) {
      this.field = hostField;
      this.valueType = BasicValueType.Array;
    } else {
      const field = context.fieldMap[fieldId];
      if (!field) {
        throw new Error(t(Strings.function_err_invalid_field_name, {
          fieldId,
        }));
      }
      this.field = field;
      if (field) {
        this.valueType = Field.bindContext(field, context.state).basicValueType;
      } else {
        this.valueType = BasicValueType.String;
      }
    }

    const innerValueType: BasicValueType | undefined = (Field.bindContext(this.field, context.state) as any).innerBasicValueType;
    this.innerValueType = innerValueType || BasicValueType.String;
  }
}

export class ValueOperandNode extends ValueOperandNodeBase {
  override readonly value!: string;
  override readonly valueType!: BasicValueType;
  override readonly name = AstNodeType.ValueOperandNode;
  override readonly field!: IField;

  constructor(token: Token, context: { state: IReduxState, fieldMap: IFieldMap }, hostField?: IField) {
    super(token);
    const fieldId = token.value.slice(1, -1);
    this.init(fieldId, context, hostField);
  }
}

export class PureValueOperandNode extends ValueOperandNodeBase {
  override readonly value!: string;
  override readonly valueType!: BasicValueType;
  override readonly name = AstNodeType.PureValueOperandNode;
  override readonly field!: IField;

  constructor(token: Token, context: { state: IReduxState, fieldMap: IFieldMap }, hostField?: IField) {
    super(token);
    const fieldId = token.value;
    this.init(fieldId, context, hostField);
  }
}

export class CallOperandNode extends AstNode {
  readonly value: string;
  override readonly name = AstNodeType.CallOperandNode;
  readonly params: AstNode[] = [];
  constructor(token: Token) {
    super(token);
    this.value = token.value;
  }
}

export class NumberOperandNode extends AstNode {
  readonly value: string;
  override readonly name = AstNodeType.NumberOperandNode;
  override valueType = BasicValueType.Number;
  constructor(token: Token) {
    super(token);
    this.value = token.value;
  }
}

export class StringOperandNode extends AstNode {
  readonly value: string;
  override readonly name = AstNodeType.StringOperandNode;
  override valueType = BasicValueType.String;

  constructor(token: Token) {
    super(token);

    let tokenValue = token.value;
    const terminatorMap = new Map([
      [/\\n/g, '\n'], // newline
      [/\\r/g, '\r'], // newline
      [/\\t/g, '\t'], // tab 
    ]);

    terminatorMap.forEach((v, k) => {
      tokenValue = tokenValue.replace(k, v);
    });
    tokenValue = tokenValue.replace(/\\(.)/g, '$1');
    this.value = tokenValue;
  }
}
