import {types as babelTypes} from '@babel/core';
import traverse from '@babel/traverse';
import Parser from '@babel/parser';
import fs from 'fs';
import glob from 'glob';
import {typeUtils} from '../utils';

/**
 * convert code to object
 * @param {string | Array<string>} filePath
 * @return {IParseResult}
 */
export const parseCode = (filePath: string | Array<string>): IParseResult => {
  const result: IParseResult = {} as IParseResult;
  const filePathArray: Array<string> = [];

  if (typeUtils.isString(filePath)) {
    glob(filePath, (err, files) => {
      if (err) {
        throw err;
      }

      filePathArray.concat(files);
    });
  } else if (typeUtils.isArray<String>(filePath)) {
    filePath.forEach((path) => {
      glob(path, (err, files) => {
        if (err) {
          throw err;
        }

        filePathArray.concat(files);
      });
    });
  }

  filePathArray.forEach((path) => {
    convertCode2Object(fs.readFileSync(path).toString(), result);
  });

  return result;
};
/**
 * Convert code into object according to file path
 * @param {string} code file code string
 * @param {IParseResult} result object
 */
export const convertCode2Object = (code: string, result: IParseResult): void => {
  const ast = Parser.parse(code, {
    sourceType: 'module',
    plugins: [
      'typescript',
      'jsx',
      'classProperties',
      'classPrivateMethods',
      'classPrivateMethods',
      'decorators',
      'doExpressions',
      'exportDefaultFrom',
      'functionBind',
      'functionSent',
      'privateIn',
    ],
  });

  traverse(ast, {
    TSInterfaceDeclaration(path) {
      const {
        id,
        // body: {
        //   body = [],
        // },
        typeParameters,
      } = path.node;

      result.interfaces[handleIdentifier(id)] = {} as SimpleResult;
      if (typeParameters !== null) result.interfaces[handleIdentifier(id)].typeParameters = handleTSTypeParameters(typeParameters);
    },
  });
};
/**
 * convert TsTypeParameters to js object
 * @param {babelTypes.TSTypeParameterDeclaration | babelTypes.TSTypeParameterInstantiation} typeParameters
 * @returns {Array<ITypeParameter>}
 */
export const handleTSTypeParameters = (typeParameters: babelTypes.TSTypeParameterDeclaration | babelTypes.TSTypeParameterInstantiation): Array<ITypeParameter> => {
  let typeParametersArr: ITypeParameter[] = [];
  const {params = [], type} = typeParameters;

  if (type === 'TSTypeParameterDeclaration' && typeUtils.isObject<babelTypes.TSTypeParameterDeclaration>(typeParameters)) {
    params.forEach((p: babelTypes.TSTypeParameter | babelTypes.TSType) => {
      if (p && p.type === 'TSTypeParameter') {
        // TODO handle constraint
        // const { name, constraint, default: dft } = p;
        const {name, default: dft} = p;
        typeParametersArr.push(`${name} ${dft ? ` = ${dft}` : ''}`);
      } else if (p) {

      }
    });
  } else if (type === 'TSTypeParameterInstantiation') {

  }

  return typeParametersArr;
};
/**
 * get the name from identifier
 * @param {babelTypes.Identifier} identifier
 * @returns {string}
 */
export const handleIdentifier = (identifier: babelTypes.Identifier): string => identifier.name;
