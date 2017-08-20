export const user = null;

/**
 * @modifies {localforage}
 * @param localforage
 */
export function loadTestData(localforage) {
    return localforage.getItem('user')
}
