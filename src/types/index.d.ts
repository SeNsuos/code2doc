/**
 * @file interfaces
 */

interface IParseResult {
  interfaces: IInterfaces;
  types: ITypes;
}

interface IInterfaces {
  [name: string]: SimpleResult;
}

interface ITypes {

}

interface SimpleResult {
  typeParameters: ITypeParameter[];
}

interface ITypeParameter {

}
