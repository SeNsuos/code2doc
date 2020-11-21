import {handleComment, JSDOCTYPE} from '../comment';
import typeUtils from '../utils/type';
import {BackObj, BackObjInterfaces, BackObjTypes, CommentParseReturn, CommonType, HandleCommentReturn, ObjectCommonType, SplitJsdocFromArrReturn} from '../types';

const SIMPLEHEAD = '| 名称 | 类型 | 说明 | 默认值 | 可选值 |\n| :--- | :--- | :--- | :--- | :--- |\n';
/**
 * 渲染函数注释
 * @param {CommentParseReturn<ReturnType<typeof handleComment>>} commentObject 待渲染对象
 * @returns {string}
 */
export const renderFunctionReadme = (commentObject: CommentParseReturn<ReturnType<typeof handleComment>>): string => {
  let result: string = '';

  const header: string = renderFunctionReadmeHeader(commentObject);
  const body: string = renderFunctionReadmeBody(commentObject);

  result = result.concat(header, '\n\n', body);

  return result;
};
/**
 * 渲染函数注释头部
 * @param {CommentParseReturn<ReturnType<typeof handleComment>>} commentObject 待解析对象
 * @returns {string}
 */
const renderFunctionReadmeHeader = (commentObject: CommentParseReturn<ReturnType<typeof handleComment>>): string => {
  const keys = Object.keys(commentObject);
  let result: string = `# 目录\n\n<dl>`;

  keys.forEach((item) => {
    if (commentObject[item] === null) return;
    result = result.concat('\n', handleSimpleCommentObject(item, commentObject[item]));
  });

  return result.concat('\n', '</dl>');
};

/**
 * 渲染目录
 * @param {string} key 索引
 * @param {object} commentObj 待渲染的注释解析对象
 * @return {string}
 */
const handleSimpleCommentObject = (key: string, commentObj: HandleCommentReturn<SplitJsdocFromArrReturn<typeof JSDOCTYPE>>) => {
  const {description: {value = ''} = {}, param = [] as any, returns} = commentObj;
  const paramStr = getParamStr(param);

  const result: string =
    `<dt><a href="#${key}">${param.length >= 1 ? key + paramStr: key}</a>${returns ? ` ⇒ <code>${returns.type}</code>` : '' }</dt>\n<dd><p>${value}</p></dd>`;

  return result.trim().trimRight();
};
/**
 * 渲染函数 readme 主体部分
 * @param {CommentParseReturn<ReturnType<typeof handleComment>>} commentObject 待渲染部分Object
 * @returns {string}
 */
const renderFunctionReadmeBody = (commentObject: CommentParseReturn<ReturnType<typeof handleComment>>): string => {
  let result: string = '# 函数\n\n';

  Object.keys(commentObject).forEach((item, idx) => {
    if (commentObject[item] === null) return;
    result = result.concat('\n', handleCommentObjectToTable(item, commentObject[item]));
  });

  return result;
};
/**
 * 渲染函数 readme 头部索引部分
 * @param {string} key key
 * @param {HandleCommentReturn<SplitJsdocFromArrReturn<typeof JSDOCTYPE>>} commentObj 待渲染部分 object
 * @returns {string}
 */
const handleCommentObjectToTable = (key: string, commentObj: HandleCommentReturn<SplitJsdocFromArrReturn<typeof JSDOCTYPE>>): string => {
  const {description: {value = ''} = {}, param = [] as any, returns} = commentObj;
  const paramStr = getParamStr<typeof param>(param);
  let result: string = '';

  result = result.concat(`<a name="${key}" id="${key}"></a>\n\n`, `## ${param.length >= 1 ? key + paramStr: key}${returns ? ` ⇒ <code>${returns.type}</code>` : '' }\n\n`, `<p>${value}</p>\n\n`, `| 参数 | 类型 | 描述 |\n| --- | --- | --- |\n`);

  param.forEach((item) => {
    const {value: paramValue, type, description = ''} = item;
    result = result.concat(`| ${paramValue} | <code>\`${type}\`</code> | ${description} |\n`);
  });

  return result;
};
/**
 * 获取参数
 * @param {Array<T>} param 带解析数组参数
 * @return {string}
 */
const getParamStr = <T extends { value: string } = any >(param: Array<T>): string => {
  let paramStr = '(';

  param.length >= 1 && param.forEach((element, idx) => {
    if (idx === param.length - 1) paramStr = paramStr.concat(element.value, ')');
    else paramStr = paramStr.concat(element.value, ', ');
  });

  return paramStr;
};
/**
 * 转义 | => \| readme无效  废弃 ❌
 * @private
 * @param {string} str 待转义字符串
 */
// const escapeStr = (str: string): string => str.replace(/\|/g, '\\|');
/**
 * 渲染Tsx组件文档
 * @param {BackObj} tsxParseBackupObject 解析后的对象
 * @return {string}
 */
export const renderTsxReadme = (tsxParseBackupObject: BackObj): string => {
  const result: string = '';
  const {types, interfaces} = tsxParseBackupObject;

  return result.concat(renderTsxInterfacesReadme(interfaces), renderTsxTypesReadme(types));
};
/**
 * 渲染Tsx组件的 interface 声明
 * @param {BackObjInterfaces} tsxInterfaces 待渲染的interfaces
 * @return {string}
 */
const renderTsxInterfacesReadme = (tsxInterfaces: BackObjInterfaces): string => {
  let result: string = '';

  Object.keys(tsxInterfaces).forEach((tsxInterface) => {
    result = result.concat(renderTsxSingleInterfaceReadme(tsxInterfaces[tsxInterface], tsxInterface));
  });

  return result;
};
/**
 * 渲染 接口 类型 readme string
 * @param {ObjectCommonType} tsxInterface 接口
 * @param {string} key 接口 name
 * @return {string}
 */
const renderTsxSingleInterfaceReadme = (tsxInterface: ObjectCommonType, key: string): string => {
  let result: string = '';
  const {typeParameters} = tsxInterface;
  // 头部 key 渲染
  result = result.concat(`### 属性 (${key}${renderTypeParametersReadme(typeParameters)})\n\n${SIMPLEHEAD}`);
  // 删除泛型类型
  delete tsxInterface.typeParameters;
  Object.keys(tsxInterface).forEach((item) => {
    result = result.concat(renderTsxObjectPropertiesReadme(tsxInterface[item], item), '\n');
  });

  return result;
};
/**
 * 处理 interface 内部字段
 * @param {CommonType} property 属性
 * @return {string}
 */
const renderTsxObjectPropertiesReadme = (property: CommonType, key: string): string => {
  let result: string = '';
  const {leadingComments} = property;
  // 如果没有注释，直接返回空字符串，强制要求编写注释
  if (!leadingComments) return '';
  // 处理当前注释
  const handledComment = handleComment(leadingComments);
  // 如果注释中含有 private 或不合规则不渲染，返回空字符串
  if (!handledComment) return '';
  const {optional, optionalValue, default: defaultValue, description} = handledComment;

  result = result.concat(`| ${key} | ${renderSimpleTypeReadme(property)} | ${description && description.value || ''} | ${defaultValue && defaultValue.value || '\\'} | ${optional && optional.value ? renderOptionalValueReadme(optionalValue && typeUtils.isString(optionalValue.value) ? optionalValue.value : '') : '必选'} |`);

  return result;
};
/**
 * 根据不同 type 处理
 * @param {CommonType} property 属性
 * @return {string}
 */
const renderSimpleTypeReadme = (property: CommonType): string => {
  let result: string = '';
  const {type, valueName, typeParameters, unionAndIntersection} = property;
  switch (type) {
    case 'generic':
      result = valueName;
      break;
    case '<>':
      result = `${valueName}${renderTypeParametersReadme(typeParameters)}`;
      break;
    case 'union':
      result = renderUnionAndIntersectionReadme(unionAndIntersection, 'union');
      break;
    case 'intersection':
      result = renderUnionAndIntersectionReadme(unionAndIntersection, 'intersection');
      break;
    default:
      result = valueName;
  }

  return '`' + result + '`';
};
/**
 * 渲染对象
 * @param {ObjectCommonType} object
 * @return {string}
 */
const renderObjectReadme = (object: ObjectCommonType): string => {
  let result: string = '{ ';
  const keys = Object.keys(object);
  keys.forEach((item, idx) => {
    if (item === 'type') return;
    result = result.concat(idx !== keys.length - 1 ? `${item}: ${renderPropertyReadme(object[item])}, ` : `${item}: ${renderPropertyReadme(object[item])}`);
  });

  return result.concat(' }');
};
/**
 * 渲染对象属性
 * @param {ObjectCommonType} property 待渲染对象属性
 * @return {string}
 */
const renderPropertyReadme = (property: ObjectCommonType): string => {
  let result: string = '';
  const {type, valueName, typeParameters, unionAndIntersection} = property;

  switch (type) {
    case 'generic':
      result = result.concat(valueName);
      break;
    case '<>':
      result = result.concat(`${valueName}${renderTypeParametersReadme(typeParameters)}`);
      break;
    case 'object':
      const keys = Object.keys(property).filter((i) => i !== 'type');
      result = result.concat('{\s');
      keys.forEach((item, idx) => {
        result = result.concat(idx === keys.length - 1 ? `${item}: ${renderObjectReadme(property[item])}, ` : `${item}: ${renderObjectReadme(property[item])}`);
      });
      result = result.concat('\s}');
      break;
    case 'union':
      result = result.concat(renderUnionAndIntersectionReadme(unionAndIntersection, 'union'));
      break;
    case 'intersection':
      result = result.concat(renderUnionAndIntersectionReadme(unionAndIntersection, 'intersection'));
      break;
    default:
      result = result.concat(valueName);
      break;
  }

  return result.concat('');
};
/**
 * 渲染联合类型
 * @param {CommonType['unionAndIntersection']} unionAndIntersection
 * @returns {string}
 */
const renderUnionAndIntersectionReadme = (unionAndIntersection: CommonType['unionAndIntersection'], type: 'union' | 'intersection'): string => {
  let result: string = '';
  const spChar: string = type === 'union' ? '\|' : '\&';

  unionAndIntersection.forEach((item: any, idx: number) => {
    if (typeUtils.isArray<CommonType['unionAndIntersection']>(item)) result = result.concat(renderUnionAndIntersectionReadme(item, type === 'union' ? 'intersection' : 'union'));
    else if (typeUtils.isObject<CommonType>(item) && item.type === '<>') result = result.concat(item.valueName, renderTypeParametersReadme(item.typeParameters));
    else if (typeUtils.isObject<CommonType>(item) && item.type === 'generic') result = result.concat(item.valueName);
    else if (typeUtils.isObject<ObjectCommonType>(item)) result = result.concat(renderObjectReadme(item));
    else result = result.concat(String(item));

    result = result.concat(idx !== unionAndIntersection.length - 1 ? ` ${spChar} ` : '' );
  });

  return result;
};
/**
 * 泛型类型 string 渲染
 * @param {CommonType.typeParameters} typeParameters 泛型数组
 * @return {string}
 */
const renderTypeParametersReadme = (typeParameters: CommonType['typeParameters']): string => {
  if (!typeParameters) return '';
  let result: string = '<';
  typeParameters.forEach((item, idx) => {
    if (typeUtils.isString(item)) result = result.concat(`${idx !== typeParameters.length - 1 ? `${item}, ` : `${item}`}`);
    if (typeUtils.isObject<CommonType>(item)) {
      const {type, valueName, typeParameters: innerTypeParameters, unionAndIntersection} = item;
      switch (type) {
        case '<>':
          result = result.concat(valueName, renderTypeParametersReadme(innerTypeParameters));
          break;
        case 'union':
          result = result.concat(renderUnionAndIntersectionReadme(unionAndIntersection, 'union'));
          break;
        case 'intersection':
          result = result.concat(renderUnionAndIntersectionReadme(unionAndIntersection, 'intersection'));
          break;
        case 'generic':
          result = result.concat(valueName);
          break;
        case 'object':
          result = result.concat(renderObjectReadme(item as ObjectCommonType));
          break;
        default:
          result = '';
          break;
      }
      result = result.concat(idx !== typeParameters.length - 1 ? ', ' : '');
    }
  });

  return result.concat('>');
};
/**
 * 解析可选参数, 返回正确的字符串
 * @param {string} optionalValue 待解析字符串
 * @return {string}
 */
const renderOptionalValueReadme = (optionalValue: string): string => {
  let result: string = '';
  const optionalValueArray: Array<string> | string = optionalValue ? optionalValue.split(',') : [];
  if (typeUtils.isArray(optionalValueArray)) {
    optionalValueArray.forEach((item, idx) => {
      if (idx === optionalValueArray.length - 1) result = result.concat(`\`${item}\``);
      else result = result.concat(`\`${item}\`, `);
    });
  } else if (typeUtils.isString(optionalValue)) {
    result = optionalValueArray;
  }

  return result;
};
/**
 * 渲染Tsx组件的 type 声明
 * @param {BackObjTypes} tsxTypes 待渲染的types
 * @return {string}
 */
const renderTsxTypesReadme = (tsxTypes: BackObjTypes): string => {
  let result: string = '';

  Object.keys(tsxTypes).forEach((tsxType) => result = result.concat(renderTsxSingleTypeReadme(tsxTypes[tsxType], tsxType)));

  return result;
};
/**
 * 渲染 tsx 组件的 单个 type 声明
 * @param {ObjectCommonType} tsxType 单个 tsxType
 * @param {string} key 对应的 key
 */
const renderTsxSingleTypeReadme = (tsxType: ObjectCommonType, key: string): string => {
  let result: string = '';
  const {typeParameters} = tsxType;
  // 头部 key 渲染
  result = result.concat(`### 属性 (${key}${renderTypeParametersReadme(typeParameters)})\n\n${SIMPLEHEAD}`);
  // 删除泛型类型
  delete tsxType.typeParameters;
  if (tsxType.type === 'obj') {
    delete tsxType.leadingComments;
    delete tsxType.type;
    Object.keys(tsxType).forEach((i) => {
      result = result.concat(renderTsxTypeObjectPropertiesReadme(tsxType[i], i), '\n');
    });
  } else if (!Object.prototype.hasOwnProperty.call(tsxType, 'type') && !Object.prototype.hasOwnProperty.call(tsxType, 'valueName')) {
    delete tsxType.leadingComments;
    Object.keys(tsxType).forEach((item) => {
      result = result.concat(renderTsxTypeObjectPropertiesReadme(tsxType[item], key));
    });
  } else {
    result = result.concat(renderTsxTypeObjectPropertiesReadme(tsxType, key));
  }

  return result;
};
/**
 * 处理 interface 内部字段
 * @param {CommonType} property 属性
 * @return {string}
 */
const renderTsxTypeObjectPropertiesReadme = (property: CommonType, key: string): string => {
  let result: string = '';
  const {leadingComments} = property;
  // 如果没有注释，直接返回空字符串，强制要求编写注释
  if (!leadingComments) return '';
  // 处理当前注释
  const handledComment = handleComment(leadingComments);
  // 如果注释中含有 private 或不合规则不渲染，返回空字符串
  if (!handledComment) return '';
  const {optional, optionalValue, default: defaultValue, description} = handledComment;

  result = result.concat(`| ${key} | ${renderSimpleTypeReadme(property)} | ${description && description.value || ''} | ${defaultValue && defaultValue.value || '\\'} | ${optional && optional.value ? renderOptionalValueReadme(optionalValue && typeUtils.isString(optionalValue.value) ? optionalValue.value : '') : '必选'} |`);

  return result;
};
