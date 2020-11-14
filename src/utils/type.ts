/**
 * Type inference
 * @param {string} type Type
 * @return {Function}
 */
const getIsType = <T = any>(type: string) => {
  /**
   * Type inference
   * @param {any} target target
   * @return {boolean}
   */
  return <R>(target: any): target is (R extends T ? R : T) => {
    return Object.prototype.toString.call(target) === `[object ${type}]`;
  };
};

export default {
  isString: getIsType<string>('String'),
  isNumber: getIsType<number>('Number'),
  isFunction: getIsType<Function>('Function'),
  isArray: getIsType<any[]>('Array'),
  isDate: getIsType<Date>('Date'),
  isObject: getIsType<{[key: string]: any}>('Object'),
  isUndefined: getIsType<undefined>('Undefined'),
  getIsType,
};
