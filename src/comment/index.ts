import {parse} from '@babel/parser';
import * as fs from 'fs';
import * as Glob from 'glob';
import {types} from '@babel/core';
import typeUtils from '../utils/type';
import {SplitJsdocFromArrReturn, HandleCommentReturn, CommentParseReturn} from '../types';
// TODO 目前支持的jsdoc类型, 未来考虑更高的拓展性
export const JSDOCTYPE = {
  type: '@type',
  param: '@param',
  description: '@description',
  private: '@private',
  returns: '@returns',
  optional: '@optional',
  optionalValue: '@optionalValue',
  default: '@default',
  version: '@version',
  undefined: '',
};
// TODO 未来考虑支持 Plugin 能力
/**
 * 多文件注释解析
 * @param {Array<string> | string} commentPaths 需提取注释的文件地址合集
 * @return {CommentParseReturn<ReturnType<typeof handleComment>>}
 */
export const parsingMultipleComments = (commentPaths: Array<string> | string): CommentParseReturn<ReturnType<typeof handleComment>> => {
  let res: CommentParseReturn<ReturnType<typeof handleComment>> = {};

  if (typeUtils.isArray<Array<string>>(commentPaths)) {
    commentPaths.forEach((item) => {
      const files = Glob.sync(item);

      files.forEach((element: string) => {
        res = Object.assign({}, res, commentParse(element));
      });
    });
  } else if (typeUtils.isString(commentPaths)) {
    const files = Glob.sync(commentPaths);

    files.forEach((element: string) => {
      res = Object.assign({}, res, commentParse(element));
    });
  }

  return res;
};

/**
 * 解析 注释
 * @param {string} commentPath 文件内容
 * @return {CommentParseReturn<ReturnType<typeof handleComment>>}
 */
export const commentParse = (commentPath: string): CommentParseReturn<ReturnType<typeof handleComment>> => {
  const commentStr: string = fs.readFileSync(commentPath).toString();
  const ast = parse(commentStr, {
    plugins: [
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
      'typescript',
    ],
    sourceType: 'module',
  });
  const res: CommentParseReturn<ReturnType<typeof handleComment>> = {};

  dfsNode(ast, (node) => {
    if (types.isFunctionDeclaration(node)) {
      const {leadingComments, id: {name} = {}} = node as types.FunctionDeclaration;
      if (leadingComments) {
        res[name] = handleComment(leadingComments);
      }
      // TODO 下期再考虑做参数
      // if (res[name] !== null) {
      //   res[name]['params'] = [];
      //   params.forEach(item => {
      //     res[name]['params'].push(handleTypeParameters(item as any));
      //   })
      // }
    }

    if (types.isVariableDeclaration(node)) {
      const {declarations, leadingComments: variableFunctionLeadingComments} = node as types.VariableDeclaration;

      declarations.forEach((element) => {
        if (types.isVariableDeclarator(element)) {
          const {init, id: {name: variableFunctionName} = {} as any} = element;
          if ((types.isFunctionExpression(init) || types.isArrowFunctionExpression(init)) && variableFunctionLeadingComments) {
          // const { params: variableFunctionParmas } = init
            res[variableFunctionName] = handleComment(variableFunctionLeadingComments);
            // TODO 下期再考虑做参数
            // if (res[variableFunctionName] !== null) {
            //   res[variableFunctionName]['params'] = [];

            //   variableFunctionParmas.forEach(item => {
            //     res[variableFunctionName]['params'].push(handleTypeParameters(item as any));
            //   })
            // }
          }
        }
      });
    }

    if (types.isExportDeclaration(node) || types.isExportDefaultDeclaration(node) || types.isExportNamedDeclaration(node)) {
      const {leadingComments: exportLeadingComments, declaration} = node;
      if (types.isVariableDeclaration(declaration)) {
        const {declarations} = declaration as types.VariableDeclaration;

        declarations.forEach((element) => {
          if (types.isVariableDeclarator(element)) {
            const {init, id: {name: variableFunctionName} = {} as any} = element;
            if ((types.isFunctionExpression(init) || types.isArrowFunctionExpression(init)) && exportLeadingComments) {
              res[variableFunctionName] = handleComment(exportLeadingComments);
            }
          }
        });
      } else if (types.isFunctionDeclaration(declaration)) {
        const {id: {name} = {}} = declaration as types.FunctionDeclaration;
        if (exportLeadingComments) {
          res[name] = handleComment(exportLeadingComments);
        }
      }
    }

    if (types.isProperty(node)) {
      const {key: {name: propertyName} = {} as any, value, leadingComments: propertyLeadingComments} = node as types.Property;
      if ((value && value.type === 'FunctionExpression' || value.type === 'ArrowFunctionExpression') && propertyLeadingComments) {
        res[propertyName] = handleComment(propertyLeadingComments);
      }
    }

    if (types.isClassProperty(node)) {
      const {key: {name: classPropertiesName} = {} as any, value, leadingComments: classPropertiesLeadingComments} = node as types.ClassProperty;
      if ((value && value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression') && classPropertiesLeadingComments) {
        res[classPropertiesName] = handleComment(classPropertiesLeadingComments);
      }
    }

    if (types.isClassMethod(node)) {
      const {leadingComments: classMethodLeadingComments, key: {name: classMethodName} = {} as any} = node as types.ClassMethod;
      if (classMethodLeadingComments) res[classMethodName] = handleComment(classMethodLeadingComments);
    }
  });

  return res;
};

/**
 * 遍历 ast 树
 * @param {T} node 节点
 * @param {(node: T) => any} callback 回调函数
 */
const dfsNode = <T>(node: T, callback: (node: T) => any) => {
  callback(node);

  // 有 type 字段的我们认为是一个节点
  Object.keys(node).forEach((key) => {
    const item = node[key];
    if (Array.isArray(item)) {
      item.forEach((sub) => {
        sub.type && dfsNode(sub, callback);
      });
    }

    item && item.type && dfsNode(item, callback);
  });
};

/**
 * 处理块级注释
 * @param {Array<types.CommentBlock>} comments
 */
export const handleComment = (comments: ReadonlyArray<types.Comment>): HandleCommentReturn<ReturnType<typeof splitJsdocFromArr>> | null => {
  // 多个块级注释取最靠近函数的那一个
  let currentComment: number = 0;
  comments.forEach((item, idx) => {
    if (item && item.type === 'CommentBlock') currentComment = idx;
  });

  const comment = comments[currentComment];
  // 如果不是块级注释 直接返回
  if (comment && comment.type !== 'CommentBlock') return null;

  const {value} = comment;
  const backObj: HandleCommentReturn<SplitJsdocFromArrReturn<typeof JSDOCTYPE>> = {};
  const valueArray = value.replace(/(?<!{)\*+/g, '').trim().trimRight().split(/\n/).filter((item) => item.trim() !== '');

  if (isPrivate(valueArray)) return null;

  valueArray.forEach((item) => setName(splitJsdocFromArr(item), backObj));

  return backObj;
};
/**
 * 处理 jsdocArr 中的单个字符串 返回处理后的对象
 * @param {string} str 字符串
 */
export const splitJsdocFromArr = (str: string): SplitJsdocFromArrReturn<typeof JSDOCTYPE> | null => {
  // 普通 description 注释
  if (str.indexOf('@') === -1) {
    return {
      name: 'description',
      value: str,
    };
  }

  if (Object.keys(JSDOCTYPE).findIndex((item, idx) => {
    if (str.indexOf(item) !== -1) return idx;

    return -1;
  }) === -1) throw TypeError(`handle the comment ${str} ------- find invalid docType! please checkout!`);

  // description 描述
  if (str.indexOf(JSDOCTYPE.description) !== -1) return handleSimpleJsdoc(str, 'description');
  // type 类型
  else if (str.indexOf(JSDOCTYPE.type) !== -1) return handleSimpleJsdoc(str, 'type');
  // version
  else if (str.indexOf(JSDOCTYPE.version) !== -1) return handleSimpleJsdoc(str, 'version');
  // optionalValue
  else if (str.indexOf(JSDOCTYPE.optionalValue) !== -1) {
    const optionalValueStrArr: Array<string> = str.trim().split(/\s+/);
    if (!isTypeFirstPlace(optionalValueStrArr, 'optionalValue')) throw TypeError(`handle the comment ${str} ------- expect ${JSDOCTYPE['optionalValue']} in the first place, but find ${optionalValueStrArr[0]}!`);
    const optionalArray: string = str.match(/\[.+\]/)[0];

    return {
      name: 'optionalValue',
      value: optionalArray,
    };
  }
  // optional
  else if (str.indexOf(JSDOCTYPE.optional) !== -1) {
    return {
      name: 'optional',
      value: true,
    };
  }
  // returns
  else if (str.indexOf(JSDOCTYPE.returns) !== -1) {
    if (!/{.+}/.test(str)) throw TypeError(`handle the comment ${str} ------- expect param's type, but find null!`);
    const matchResult: RegExpMatchArray = str.match(/{.+}/) || [];
    const params: string = matchResult[0];
    if (!/^{.+}$/.test(params)) throw TypeError(`handle the comment ${str} ------- expect param's Type, but find ${params || 'nothing'}!`);
    const replaceStr = str.replace(params, '');
    const strArr: Array<string> = replaceStr.trim().split(/\s+/);
    if (!isTypeFirstPlace(strArr, 'returns')) throw TypeError(`handle the comment ${str} ------- expect ${JSDOCTYPE['returns']} in the first place, but find ${strArr[0]}!`);

    let resultDescription: string = '';

    for (let i = 2; i < strArr.length; ++i) {
      resultDescription += strArr[i];
    }

    return {
      name: 'returns',
      value: strArr[1],
      type: params.replace(/{|}/g, ''),
      description: resultDescription,
    };
  }
  // params
  else if (str.indexOf(JSDOCTYPE.param) !== -1) {
    if (/^{.*}/.test(str)) throw TypeError(`handle the comment ${str} ------- expect param's type, but find null!`);
    const matchResult: RegExpMatchArray = str.match(/{.+}/) || [];
    const params: string = matchResult[0];
    if (!/^{.*}$/.test(params) || params.length === 2) throw TypeError(`handle the comment ${str} ------- expect param's Type, but find ${params || 'nothing'}!`);
    const replaceStr = str.replace(params, '');
    const strArr: Array<string> = replaceStr.trim().split(/\s+/);
    if (!isTypeFirstPlace(strArr, 'param')) throw TypeError(`handle the comment ${str} ------- expect ${JSDOCTYPE['param']} in the first place, but find ${strArr[0]}!`);
    if (strArr[1].trim() === '') throw TypeError(`handle the comment ${str} ------- expect param's name, but find ${strArr[1]}`);

    let resultDescription: string = '';

    for (let i = 2; i < strArr.length; ++i) {
      resultDescription += strArr[i];
    }

    return {
      name: 'param',
      value: strArr[1],
      type: params.replace(/{|}/g, ''),
      description: resultDescription,
    };
  }
  // default
  else if (str.indexOf(JSDOCTYPE.default) !== -1) {
    const defaultStrArr: Array<string> = str.trim().split(/\s+/);
    if (!isTypeFirstPlace(defaultStrArr, 'default')) throw TypeError(`handle the comment ${str} ------- expect ${JSDOCTYPE['default']} in the first place, but find ${defaultStrArr[0]}!`);
    let defaultValue: string = '';
    defaultStrArr.forEach((item, idx) => {
      if (idx === 0) return;
      defaultValue = defaultValue.concat(item);
    });

    return {
      name: 'default',
      value: defaultValue,
    };
  } else {
    return {
      name: 'undefined',
      value: '',
    };
  }
};

/**
 * 处理简单 jsdoc 类型
 * @param {string} str 字符串
 * @param {string} type 类型
 */
export const handleSimpleJsdoc = (str: string, type: keyof typeof JSDOCTYPE): SplitJsdocFromArrReturn<typeof JSDOCTYPE> => {
  let result: string = '';
  const strArr: Array<string> = str.trim().split(/\s+/);
  if (!isTypeFirstPlace(strArr, type)) throw TypeError(`expect ${JSDOCTYPE[type]} in the first place, but find ${strArr[0]}`);

  strArr.forEach((item, idx) => {
    if (idx === 0) return;
    result += item;
  });

  return {
    name: type,
    value: result,
  };
};

/**
 * 判断当前字符串是否是以 XXX 开头
 * @param {string} strArr 字符数组
 * @param {string} type 类型
 */
export const isTypeFirstPlace = (strArr: Array<string>, type: keyof typeof JSDOCTYPE): boolean => strArr[0] === JSDOCTYPE[type];
/**
 * 设置属性
 * @param {SplitJsdocFromArrReturnM} backup
 * @param {T} resObj
 */
const setName = <T>(backup: SplitJsdocFromArrReturn<typeof JSDOCTYPE>, resObj: T): void => {
  const {name} = backup;
  delete backup.name;
  if (name === 'param') {
    if (resObj[name] === undefined) resObj[name] = [];
    resObj[name].push(backup);
  } else {
    resObj[name] = backup;
  }
};
/**
 * 判断是否有 private 属性
 * @param {Array<string>} strArr 字符数组
 */
export const isPrivate = (strArr: Array<string>): boolean => {
  let resFlag: boolean = false;
  strArr.forEach((str) => {
    if (str.indexOf(JSDOCTYPE.private) !== -1) resFlag = true;
  });

  return resFlag;
};
