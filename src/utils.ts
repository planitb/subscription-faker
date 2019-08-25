
// it appears that the graphQL mocker creates "objects" that do not inherit fom Object. This upsets JsonPath.
export function convertToObject(r: object): any {
    return JSON.parse(JSON.stringify(r));
}
