import { types } from "@babel/core";

export interface BackObj {
  interfaces: BackObjInterfaces;
  types: BackObjTypes;
}

export interface BackObjInterfaces {
  [x: string]: ObjectCommonType;
  typeParameters?: any;
}

export interface BackObjTypes extends BackObjInterfaces {}

export interface ObjectCommonType extends CommonType {
  name?: string;
}

export interface CommonType {
  type?: string;
  valueName?: string;
  typeParameters?: null | Array<CommonType | ObjectCommonType | string>;
  unionAndIntersection?: Array<CommonType | ObjectCommonType | string>;
  optional?: boolean;
  leadingComments?: readonly types.Comment[]
}

export interface SplitJsdocFromArrReturn<T> {
  name: keyof T;
  type?: string;
  value: string | boolean;
  description?: string;
}

export interface HandleCommentReturn<T = any> {
  [name: string]: T;
  params?: any;
}

export interface CommentParseReturn<T> extends HandleCommentReturn<T> {
  params?: any;
}