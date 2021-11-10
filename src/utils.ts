import _ from "lodash";


/*
 * A mix of lodash _.pick and _.get, thx stackoverflow people
 */
export const flatPick = (object: {}, paths: string[]) => {
  const o = {};

  paths.forEach(path => _.set(
    o,
    <_.PropertyPath>_.last(path.split('.'))!,
    _.get(object, path)
  ));

  return o;
}
