import { types as babelTypes } from '@babel/core';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as fs from 'fs';
import typeUtils from '../utils/type';
import { BackObj, CommonType, ObjectCommonType } from '../types';

const TYPE: { [x: string]: string } = {
  INTERFACE: 'InterfaceDeclaration',
  OBJ: 'ObjectTypeAnnotation',
  UNION: 'UnionTypeAnnotation',
  STRING: 'StringTypeAnnotation',
  NUMBER: 'NumberTypeAnnotation',
  GENERIC: 'GenericTypeAnnotation',
  INTERSECTION: 'IntersectionTypeAnnotation'
};

const TYPEANNOTATION = /TypeAnnotation/;
/**
 * 解析 Tsx 文件
 * @param {string} path 文件路径
 * @returns {BackObj}
 */
export function parseTsx(path: string): BackObj {
  console.warn('该api 已经废弃, 请使用parseTs');
  const code: string = fs.readFileSync(path).toString();
  const ast = parse(code, {
    plugins: [
      'flow',
      'jsx',
      'classProperties',
      'classPrivateMethods',
      'classPrivateProperties',
      'decorators-legacy',
      'doExpressions',
      'exportDefaultFrom',
      'functionBind',
      'functionSent',
      'logicalAssignment',
      'numericSeparator',
    ],
    sourceType: 'module',
  });
  // 定义 返回值
  const backObj: BackObj = {
    interfaces: {},
    types: {}
  };
  // 遍历 ast
  traverse(ast, {
    // interface 声明
    InterfaceDeclaration(path) {
      const {
        id: {
          name
        },
        body: {
          properties = []
        } = {},
        typeParameters
      } = path.node;
      backObj.interfaces[name] = {
        typeParameters: handleTypeParameters(typeParameters)
      };

      properties && properties.length > 0 && properties.forEach(item => {
        handleBackupObjectProperties<typeof backObj.interfaces[any]>(handleObjectTypeProperty(item), backObj.interfaces[name]);
      });
    },
    // types
    TypeAlias(path) {
      const {
        id: {
          name = ''
        } = {},
        right,
        typeParameters,
        leadingComments
      } = path.node;
      backObj.types[name] = {
        typeParameters: handleTypeParameters(typeParameters),
        leadingComments
      };

      if (babelTypes.isGenericTypeAnnotation(right)) {
        const {
          id: genericId,
          typeParameters
        } = right;

        if (!typeParameters) {
          backObj.types[name].valueName = handleSimpleId(genericId);
        } else {
          backObj.types[name][handleSimpleId(genericId)] = {
            valueName: handleSimpleId(genericId),
            typeParameters: handleTypeParameters(typeParameters)
          };
        }
      } else if (babelTypes.isObjectTypeAnnotation(right)) {
        const {
          properties = []
        } = right;

        properties.forEach(item => {
          handleBackupObjectProperties(handleObjectTypeProperty(item), backObj.types[name]);
        });
      } else if (babelTypes.isUnionTypeAnnotation(right) || babelTypes.isIntersectionTypeAnnotation(right)) {
        const { types, type } = right;

        backObj.types[name] = {
          type: type.replace(TYPEANNOTATION, '').toLowerCase(),
          unionAndIntersection: handleUnionAndIntersection(types)
        };
      } else if (right.type.indexOf('Literal') !== -1) {
        backObj.types[name].valueName = (right as any).value;
      } else {
        backObj.types[name].valueName = right.type.replace(TYPEANNOTATION, '').toLowerCase();
      }
    }
  });

  return backObj;
}
/**
 * 解析对象属性
 * @param {babelTypes.ObjectTypeProperty | babelTypes.ObjectTypeSpreadProperty} node 带解析节点
 * @returns {ObjectCommonType}
 */
export function handleObjectTypeProperty(node: babelTypes.ObjectTypeProperty | babelTypes.ObjectTypeSpreadProperty): ObjectCommonType {
  if (!node) return null;
  const { key, value, optional, leadingComments } = node as babelTypes.ObjectTypeProperty;
  const name: string = handleSimpleName(key);
  switch (value.type) {
    case TYPE.GENERIC:
      const { typeParameters = null, id } = value as babelTypes.GenericTypeAnnotation;
      return {
        name,
        type: typeParameters === null ? 'generic' : '<>',
        valueName: handleSimpleId(id),
        optional,
        typeParameters: handleTypeParameters(typeParameters),
        leadingComments
      };
    case TYPE.OBJ:
      const {
        properties = [],
      } = value as babelTypes.ObjectTypeAnnotation;
      const obj = {};
      properties.forEach(item => handleBackupObjectProperties(handleObjectTypeProperty(item), obj));

      return {
        name,
        type: 'object',
        optional,
        leadingComments,
        ...obj
      };
    case TYPE.INTERSECTION:
      const { types: intersectionTypes, type: intersectionType } = value as babelTypes.IntersectionTypeAnnotation;
      return {
        name,
        optional,
        type: intersectionType.replace(TYPEANNOTATION, '').toLowerCase(),
        unionAndIntersection: handleUnionAndIntersection(intersectionTypes),
        leadingComments
      };
    case TYPE.UNION:
      const { types: unionTypes, type: unionType } = value as babelTypes.UnionTypeAnnotation;
      return {
        name,
        optional,
        type: unionType.replace(TYPEANNOTATION, '').toLowerCase(),
        unionAndIntersection: handleUnionAndIntersection(unionTypes),
        leadingComments
      };
    default:
      const { type: valueType, value: literalValue } = value as any;
      if (valueType.indexOf('Literal') === -1) {
        return {
          name,
          valueName: valueType.replace(TYPEANNOTATION, '').toLowerCase(),
          optional,
          leadingComments
        };
      } else {
        return {
          name,
          valueName: literalValue,
          optional,
          leadingComments
        };
      }
  }
}
/**
 * 解析泛型参数
 * @param {babelTypes.TypeParameterInstantiation} typeParameters 带解析泛型参数
 * @returns {CommonType['typeParameters']}
 */
export function handleTypeParameters(typeParameters: babelTypes.TypeParameterInstantiation | babelTypes.TypeParameterDeclaration): CommonType['typeParameters'] {
  if (!typeParameters) return null;
  if (typeParameters.type !== 'TypeParameterInstantiation' && typeParameters.type !== 'TypeParameterDeclaration') return null;
  const { params } = typeParameters;
  const backUpParams: CommonType['typeParameters'] = [];
  params && params.length > 0 && params.forEach((item) => {
    if (babelTypes.isGenericTypeAnnotation(item)) {
      backUpParams.push({
        valueName: handleSimpleId(item.id),
        type: !item.typeParameters ? 'generic' : '<>',
        typeParameters: handleTypeParameters(item.typeParameters)
      });
    } else if (babelTypes.isObjectTypeAnnotation(item)) {
      const {
        properties = []
      } = item;
      const obj = {
        type: 'object',
      };
      properties.forEach(item => handleBackupObjectProperties(handleObjectTypeProperty(item), obj));

      backUpParams.push(obj);
    } else if (babelTypes.isUnionTypeAnnotation(item) || babelTypes.isIntersectionTypeAnnotation(item)) {
      const { types, type } = item;

      backUpParams.push({
        type: type.replace(TYPEANNOTATION, '').toLowerCase(),
        unionAndIntersection: handleUnionAndIntersection(types)
      });
    } else if (babelTypes.isTypeParameter(item)) {
      backUpParams.push(item.name);
    } else if (item.type.indexOf('Literal') !== -1) {
      backUpParams.push((item as any).value);
    } else {
      backUpParams.push(item.type.replace(TYPEANNOTATION, '').toLowerCase());
    }
  });

  return backUpParams;
}

/**
 * 处理联合类型声明
 * @param {Array<babelTypes.Flow>} types 待处理联合类型声明
 * @returns {CommonType['unionAndIntersection']}
 */
export function handleUnionAndIntersection(types: Array<babelTypes.Flow>): CommonType['unionAndIntersection'] {
  const unionAndIntersectionArray: CommonType['unionAndIntersection'] = [];

  types.forEach(item => {
    switch (item.type) {
      case TYPE.OBJ:
        const { properties = [] } = item as babelTypes.ObjectTypeAnnotation;
        const unionInnerObj = {};

        properties.forEach(pro => handleBackupObjectProperties(handleObjectTypeProperty(pro), unionInnerObj));
        unionAndIntersectionArray.push(unionInnerObj);
        break;
      case TYPE.GENERIC:
        const { typeParameters = null, id: { name: valueName } = {} as any } = item as babelTypes.GenericTypeAnnotation;
        unionAndIntersectionArray.push({
          valueName,
          type: typeParameters === null ? 'generic' : '<>',
          typeParameters: handleTypeParameters(typeParameters)
        });
        break;
      case TYPE.UNION:
        const { types: unionTypes } = item as babelTypes.UnionTypeAnnotation;
        unionAndIntersectionArray.push(handleUnionAndIntersection(unionTypes) as any);
        break;
      case TYPE.INTERSECTION:
        const { types: intersectionTypes } = item as babelTypes.IntersectionTypeAnnotation;
        unionAndIntersectionArray.push(handleUnionAndIntersection(intersectionTypes) as any);
        break;
      default:
        if (item.type.indexOf('Literal') === -1) {
          unionAndIntersectionArray.push(item.type.replace(TYPEANNOTATION, '').toLowerCase());
        } else {
          unionAndIntersectionArray.push((item as any).value);
        }
        break;
    }
  });

  return unionAndIntersectionArray;
}
/**
 * 处理 key 
 * @param {babelTypes.Identifier | babelTypes.StringLiteral} name key
 * @returns {string}
 */
export function handleSimpleName(name: babelTypes.Identifier | babelTypes.StringLiteral): string {
  if (name.type === 'StringLiteral') return handleStringLiteralName(name);

  return name.name || '';
}
/**
 * 处理 stringLiteral 类型的 name
 * @param {babelTypes.StringLiteral} name stringLiteral 类型的 name
 * @returns {string}
 */
export function handleStringLiteralName(name: babelTypes.StringLiteral): string {
  if (name.type !== 'StringLiteral') return '';
  return name.value;
}
/**
 * 处理 id 
 * @param {babelTypes.Identifier | babelTypes.QualifiedTypeIdentifier} id id
 * @returns {string}
 */
export function handleSimpleId(id: babelTypes.Identifier | babelTypes.QualifiedTypeIdentifier): string {
  if (id.type === 'QualifiedTypeIdentifier') return handleQualificationId(id);

  return id.name || '';
}
/**
 * 处理 Qualificaion的Id 如 Rax.FunctionComponet<any>
 * @param {babelTypes.QualifiedTypeIdentifier} id QualifiedTypeIdentifier Id
 * @returns {string}
 */
export function handleQualificationId(id: babelTypes.QualifiedTypeIdentifier): string {
  let result: string = '';
  const { id: { name: idName }, qualification } = id;
  if (qualification.type === "Identifier") {
    result = result.concat(qualification.name, '.', idName);
  } else if (qualification.type === "QualifiedTypeIdentifier") {
    result = result.concat(handleQualificationId(qualification), '.', idName);
  }

  return result;
}

/**
 * 解析返回 handleObjectProperties 的数据到interfaces中
 * @param {ObjectCommonType} backup 
 * @param {T} resObj 
 * @returns {null}
 */
export function handleBackupObjectProperties<T>(backup: ObjectCommonType, resObj: T) {
  const { name } = backup;
  delete backup.name;

  resObj[name] = backup;
}
/**
 * babel typescript 插件重构
 * @param {string} path 文件路径
 * @returns {BackObj}
 */
export const parseTs = (path: string): BackObj => {
  const backObj: BackObj = {
    interfaces: {},
    types: {}
  };
  const code: string = fs.readFileSync(path).toString();

  const ast = parse(code, {
    sourceType: 'module',
    plugins: [
      'typescript',
      'jsx',
      'classProperties',
      'classPrivateMethods',
      'classPrivateProperties',
      'decorators-legacy',
      'doExpressions',
      'exportDefaultFrom',
      'functionBind',
      'functionSent',
      'logicalAssignment',
      'numericSeparator',
    ]
  })

  traverse(ast, {
    // interface 
    TSInterfaceDeclaration(path) {
      const {
        id,
        typeParameters,
        body: {
          body
        }
      } = path.node;
      const name = handleSimpleId(id);
      backObj.interfaces[name] = {
        typeParameters: handleTsTypeParameters(typeParameters),
      }
      if (typeUtils.isArray<babelTypes.TSPropertySignature>(body)) {
        body.forEach(item => {
          // 类型推断
          if (typeUtils.isObject<babelTypes.TSPropertySignature>(item)) {
            handleBackupObjectProperties<typeof backObj.interfaces[any]>(handleTSPropertySignature(item), backObj.interfaces[name]);
          }
        })
      }
    },
    // type
    TSTypeAliasDeclaration(path) {
      const {
        id,
        typeParameters,
        typeAnnotation,
        leadingComments
      } = path.node;
      const name: string = handleSimpleId(id);
      backObj.types[name] = {
        typeParameters: handleTsTypeParameters(typeParameters),
        leadingComments
      }

      if (babelTypes.isTSTypeReference(typeAnnotation)) {
        const {
          typeName,
          typeParameters
        } = typeAnnotation;
        const simpleTypeName = handleTsSimpleName(typeName);

        if (!typeParameters) {
          backObj.types[name].valueName = simpleTypeName;
        } else {
          backObj.types[name][simpleTypeName] = {
            valueName: simpleTypeName,
            typeParameters: handleTsTypeParameters(typeParameters),
            leadingComments,
            type: typeParameters ? '<>' : 'generic'
          };
        }
      } else if (babelTypes.isTSTypeLiteral(typeAnnotation)) {
        const {
          members = []
        } = typeAnnotation;
        backObj.types[name].type = 'obj';

        (members as babelTypes.TSPropertySignature[]).forEach(item => {
          handleBackupObjectProperties(handleTSPropertySignature(item), backObj.types[name]);
        });
      } else if (babelTypes.isTSUnionType(typeAnnotation) || babelTypes.isTSIntersectionType(typeAnnotation)) {
        const { types, type } = typeAnnotation;

        backObj.types[name] = {
          type: type.toLowerCase().replace('ts', '').replace('type', ''),
          unionAndIntersection: handleTsUnionAndIntersection(types),
          leadingComments
        };
      } else if (babelTypes.isLiteral(typeAnnotation)) {
        backObj.types[name].valueName = handleTsLiteral(typeAnnotation);
        backObj.types[name].leadingComments = leadingComments;
      } else {
        backObj.types[name].valueName = handleSimpleTypeToString(typeAnnotation);
        backObj.types[name].leadingComments = leadingComments;
      }
    }
  })

  return backObj;
}
/**
 * 处理 tsPropertySignature
 * @param {babelTypes.TSPropertySignature} tsPropertySignature 
 * @returns {ObjectCommonType}
 */
export const handleTSPropertySignature = (tsPropertySignature: babelTypes.TSPropertySignature): ObjectCommonType => {
  if (!tsPropertySignature || tsPropertySignature.type !== 'TSPropertySignature') return null;
  const { key, typeAnnotation, leadingComments, optional = false } = tsPropertySignature;
  const name = handleSimpleId(key as babelTypes.Identifier);
  const { typeAnnotation: tA } = typeAnnotation;

  // 处理 typeAnnotation
  if (tA.type === 'TSTypeReference') {
    const { typeParameters = null, typeName } = tA;
    return {
      name,
      type: typeParameters === null ? 'generic' : '<>',
      valueName: handleTsSimpleName(typeName),
      optional,
      typeParameters: handleTsTypeParameters(typeParameters),
      leadingComments
    };
  } else if (tA.type === 'TSTypeLiteral') {
    const { members = [] } = tA;
    const obj = {};
    members.forEach(item => handleBackupObjectProperties(handleTSPropertySignature(item as babelTypes.TSPropertySignature), obj));

    return {
      name,
      type: 'object',
      optional,
      leadingComments,
      ...obj
    };
  } else if (tA.type === 'TSIntersectionType' || tA.type === 'TSUnionType') {
    const { types: unionAndIntersectionTypes, type: unionAndIntersectionType } = tA;
    return {
      name,
      optional,
      type: unionAndIntersectionType.toLowerCase().replace('ts', '').replace('type', ''),
      unionAndIntersection: handleTsUnionAndIntersection(unionAndIntersectionTypes),
      leadingComments
    };
  } else if (tA.type === 'TSLiteralType') {
    return {
      name,
      valueName: handleTsLiteral(tA.literal),
      optional,
      leadingComments
    }
  } else {
    return {
      name,
      valueName: handleSimpleTypeToString(tA),
      optional,
      leadingComments
    }
  }
}
/**
 * 处理 ts 泛型参数
 * @param {babelTypes.TSTypeParameterDeclaration | babelTypes.TSTypeParameterInstantiation} tsTypeParameter 
 * @returns {CommonType['typeParameters']}
 */
export const handleTsTypeParameters = (tsTypeParameter: babelTypes.TSTypeParameterInstantiation | babelTypes.TSTypeParameterDeclaration): CommonType['typeParameters'] => {
  if (!tsTypeParameter && !(babelTypes.isTSTypeParameterDeclaration(tsTypeParameter) && !babelTypes.isTSTypeParameterDeclaration(tsTypeParameter))) return null;
  const { params = [] } = tsTypeParameter;
  const backTypeParams: CommonType['typeParameters'] = [];
  if (babelTypes.isTSTypeParameterDeclaration(tsTypeParameter) && typeUtils.isArray<babelTypes.TSTypeParameter[]>(params)) handleTsTypeParameterDeclaration(params, backTypeParams);
  if (babelTypes.isTSTypeParameterInstantiation(tsTypeParameter) && typeUtils.isArray<babelTypes.TSType[]>(params)) handleTsTypeParameterInstantiation(params, backTypeParams);

  return backTypeParams;
}
/**
 * 解析泛型参数
 * @param {Array<babelTypes.TSTypeParameter>} params 参数
 * @param {CommonType['typeParameters']} backTypeParams 结果存储对象
 * @returns {void}
 */
export const handleTsTypeParameterDeclaration = (params: Array<babelTypes.TSTypeParameter>, backTypeParams: CommonType['typeParameters']): void => {
  params &&
    params.length > 0 &&
    // TODO constraint default 待处理
    params.forEach(item => backTypeParams.push(item.name));
}
/**
 * 解析泛型参数
 * @param {Array<babelTypes.TSType>} params 参数
 * @param {CommonType['typeParameters']} backTypeParams 结果存储对象
 * @returns {void}
 */
export const handleTsTypeParameterInstantiation = (params: Array<babelTypes.TSType>, backTypeParams: CommonType['typeParameters']): void => {
  params &&
    params.length > 0 &&
    params.forEach((item, idx) => {
      const { type } = item;
      // 泛型 | 自定义类型
      if (type === 'TSTypeReference' && typeUtils.isObject<babelTypes.TSTypeReference>(item)) {
        backTypeParams.push({
          valueName: handleTsSimpleName(item.typeName),
          type: !item.typeParameters ? 'generic' : '<>',
          typeParameters: handleTsTypeParameters(item.typeParameters)
        });
      } else if (type === 'TSTypeLiteral' && typeUtils.isObject<babelTypes.TSTypeLiteral>(item)) {
        const { members = [] } = item;
        const obj = {
          type: 'object',
        };
        members.forEach(item => handleBackupObjectProperties(handleTSPropertySignature(item as babelTypes.TSPropertySignature), obj));

        backTypeParams.push(obj);
      } else if (babelTypes.isTSUnionType(item) || babelTypes.isTSIntersectionType(item)) {
        const { types, type } = item;

        backTypeParams.push({
          type: type.toLowerCase().replace('ts', '').replace('type', ''),
          unionAndIntersection: handleTsUnionAndIntersection(types)
        });
      } else if (type === 'TSLiteralType' && typeUtils.isObject<babelTypes.TSLiteralType>(item)) {
        const { literal } = item;
        backTypeParams.push(literal && literal.value.toString() || '');
      } else {
        backTypeParams.push(type.toLowerCase().replace('ts', '').replace('keyword', ''));
      }
    })
}
/**
 * 处理联合类型
 * @param {Array<babelTypes.TSType>} tsTypes 联合类型
 * @returns {CommonType['unionAndIntersection']}
 */
export const handleTsUnionAndIntersection = (tsTypes: Array<babelTypes.TSType>): CommonType['unionAndIntersection'] => {
  const unionAndIntersectionArray: CommonType['unionAndIntersection'] = [];

  tsTypes.forEach(item => {
    if (item.type === 'TSTypeLiteral') {
      const { members = [] } = item;
      const unionInnerObj = {};

      members.forEach(pro => handleBackupObjectProperties(handleTSPropertySignature(pro as babelTypes.TSPropertySignature), unionInnerObj));
      unionAndIntersectionArray.push(unionInnerObj);
    } else if (item.type === 'TSTypeReference') {
      const { typeParameters = null, typeName } = item;
      unionAndIntersectionArray.push({
        valueName: handleTsSimpleName(typeName),
        type: typeParameters === null ? 'generic' : '<>',
        typeParameters: handleTsTypeParameters(typeParameters)
      });
    } else if (item.type === 'TSUnionType' || item.type === 'TSIntersectionType') {
      const { types: unionAndIntersectionTypes } = item;
      unionAndIntersectionArray.push(handleTsUnionAndIntersection(unionAndIntersectionTypes) as any);
    } else if (item.type === 'TSLiteralType') {
      const { literal = {} as babelTypes.Literal } = item;
      const value = handleTsLiteral(literal);
      unionAndIntersectionArray.push(value);
    } else {
      unionAndIntersectionArray.push(item.type.toLowerCase().replace('ts', '').replace('keyword', ''));
    }
  });

  return unionAndIntersectionArray;
}
/**
 * 处理 tsLiteral 转换为可处理字符串
 * @param {babelTypes.Literal} literal literal类型
 * @returns {string}
 */
export const handleTsLiteral = (literal: babelTypes.Literal): string => {
  let result: string = '';
  if (literal.type === 'NullLiteral') {
    result = 'null';
  } else if (literal.type === 'RegExpLiteral') {
    const { pattern = '', flags = '' } = literal;
    result = pattern + flags;
  } else if (literal.type === 'TemplateLiteral') {
    const { quasis } = literal;
    const valueObj = quasis && quasis[0].value || { raw: '' };
    result = valueObj.raw;
  } else {
    result = literal.value.toString();
  }

  return result;
}
/**
 * 处理普通Literal类型 => string
 * @param {babelTypes.TSType} type 类型
 * @returns {string}
 */
export const handleSimpleTypeToString = (type: babelTypes.TSType): string => type.type ? type.type.toLowerCase().replace('ts', '').replace('keyword', '') : '';
/**
 * 处理 name
 * @param {babelTypes.TSEntityName} name 名称
 * @returns {string}
 */
export function handleTsSimpleName(name: babelTypes.TSEntityName): string {
  if (name.type === 'TSQualifiedName') return handleTsQualifiedName(name);

  return name.name || '';
}
/**
 * 处理 TSQualifiedName 如 Rax.FunctionComponet<any>
 * @param {babelTypes.TSQualifiedName} name TSQualifiedName
 * @returns {string}
 */
export function handleTsQualifiedName(name: babelTypes.TSQualifiedName): string {
  let result: string = '';
  const { left, right } = name;
  result = result.concat(handleTsSimpleName(left), '.', right.name)

  return result;
}