import Store from 'electron-store';

import {
  AnimeData,
  CurrentListAnime,
  MostPopularAnime,
  TrendingAnime,
} from '../../types/anilistAPITypes';
import { MediaListStatus } from '../../types/anilistGraphQLTypes';
import { ClientData } from '../../types/types';
import { clientData } from '../clientData.ts';
import { getOptions, makeRequest } from '../requests';
import isAppImage from '../packaging/isAppImage';
import { app, ipcRenderer } from 'electron';

const STORE: any = new Store();
const CLIENT_DATA: ClientData = clientData;
const PAGES: number = 20;
const METHOD: string = 'POST';
const GRAPH_QL_URL: string = 'https://graphql.anilist.co';
const HEADERS: Object = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};
const MEDIA_DATA: string = `
        id
        title {
            romaji
            english
            native
            userPreferred
        }
        format
        status
        description
        startDate {
            year
            month
            day
        }
        endDate {
            year
            month
            day
        }
        season
        seasonYear
        episodes
        duration
        coverImage {
            large
            extraLarge
            color
        }
        bannerImage
        genres
        synonyms
        averageScore
        meanScore
        popularity
        favourites
        isAdult
        nextAiringEpisode {
            id
            timeUntilAiring
            episode
        }
        mediaListEntry {
            id
            mediaId
            status
            score(format:POINT_10)
            progress
        }
        siteUrl
        trailer {
            id
            site
            thumbnail
        }
    `;

/**
 * Retrieves the access token for the api
 *
 * @param {*} code
 * @returns access token
 */
export const getAccessToken = async (code: string): Promise<string> => {
  const url = 'https://anilist.co/api/v2/oauth/token';

  const data = {
    grant_type: 'authorization_code',
    client_id: CLIENT_DATA.clientId,
    client_secret: CLIENT_DATA.clientSecret,
    redirect_uri:
      isAppImage || !app.isPackaged
        ? 'https://anilist.co/api/v2/oauth/pin'
        : clientData.redirectUri,
    code: code,
  };

  const respData = await makeRequest(METHOD, url, HEADERS, data);
  console.log(respData);
  return respData.access_token;
};

/**
 * Gets the anilist viewer (user) id
 *
 * @returns viewer id
 */
export const getViewerId = async (): Promise<number> => {
  var query = `
          query {
              Viewer {
                  id
              }
          }
      `;

  var headers = {
    Authorization: 'Bearer ' + STORE.get('access_token'),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const options = getOptions(query);
  const respData = await makeRequest(METHOD, GRAPH_QL_URL, headers, options);

  return respData.data.Viewer.id;
};

/**
 * Gets the viewer (user) info
 *
 * @param {*} viewerId
 * @returns object with viewer info
 */
export const getViewerInfo = async (viewerId: number | null) => {
  var query = `
          query($userId : Int) {
              User(id: $userId, sort: ID) {
                  id
                  name
                  avatar {
                      medium
                  }
              }
          }
      `;

  var headers = {
    Authorization: 'Bearer ' + STORE.get('access_token'),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  var variables = {
    userId: viewerId,
  };

  const options = getOptions(query, variables);
  const respData = await makeRequest(METHOD, GRAPH_QL_URL, headers, options);

  return respData.data.User;
};

/**
 * Gets a viewer list (current, completed...)
 *
 * @param {*} viewerId
 * @param {*} status
 * @returns object with anime entries
 */
export const getViewerList = async (
  viewerId: number,
  status: MediaListStatus,
): Promise<CurrentListAnime> => {
  var query = `
          query($userId : Int) {
              MediaListCollection(userId : $userId, type: ANIME, status : ${status}, sort: UPDATED_TIME_DESC) {
                  lists {
                      isCustomList
                      name
                      entries {
                          id
                          mediaId
                          progress
                          media {
                              ${MEDIA_DATA}
                          }
                      }
                  }
              }
          }
      `;

  var headers = {
    Authorization: 'Bearer ' + STORE.get('access_token'),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  var variables = {
    userId: viewerId,
  };

  const options = getOptions(query, variables);

  const respData = await makeRequest(METHOD, GRAPH_QL_URL, headers, options);

  return respData.data.MediaListCollection.lists.length === 0
    ? []
    : respData.data.MediaListCollection.lists[0].entries;
};

// NOT WORKING
export const getFollowingUsers = async (viewerId: any) => {
  var query = `
          query($userId : Int) {
              User(id: $userId, sort: ID) {
                  id
                  name
                  avatar {
                      large
                  }
              }
          }
      `;

  var headers = {
    Authorization: 'Bearer ' + STORE.get('access_token'),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  var variables = {
    userId: viewerId,
  };

  const options = getOptions(query, variables);
  const respData = await makeRequest(METHOD, GRAPH_QL_URL, headers, options);
};

/**
 * Gets the info from an anime
 *
 * @param {*} animeId
 * @returns object with anime info
 */
export const getAnimeInfo = async (animeId: any) => {
  var query = `
          query($id: Int) {
              Media(id: $id, type: ANIME) {
                  ${MEDIA_DATA}
              }
          }
      `;

  var headers = {
    Authorization: 'Bearer ' + STORE.get('access_token'),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  var variables = {
    id: animeId,
  };

  const options = getOptions(query, variables);
  const respData = await makeRequest(METHOD, GRAPH_QL_URL, headers, options);

  return respData.data.Media;
};

/**
 * Gets the current trending animes on anilist
 * pass viewerId to make an authenticated request
 *
 * @param {*} viewerId
 * @returns object with trending animes
 */
export const getTrendingAnime = async (
  viewerId: number | null,
): Promise<TrendingAnime> => {
  var query = `
      {
          Page(page: 1, perPage: ${PAGES}) {
              pageInfo {
                  total
                  currentPage
                  hasNextPage
              }
              media(sort: TRENDING_DESC, type: ANIME) {
                  ${MEDIA_DATA}
              }
          } 
      }
      `;

  if (viewerId) {
    var headers: any = {
      Authorization: 'Bearer ' + STORE.get('access_token'),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  } else {
    var headers: any = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  const options = getOptions(query);
  const respData = await makeRequest(METHOD, GRAPH_QL_URL, headers, options);
  return respData.data.Page;
};

/**
 * Gets the current most popular animes on anilist
 * pass viewerId to make an authenticated request
 *
 * @param {*} viewerId
 * @returns object with most popular animes
 */
export const getMostPopularAnime = async (
  viewerId: number | null,
): Promise<MostPopularAnime> => {
  var query = `
      {
          Page(page: 1, perPage: ${PAGES}) {
              pageInfo {
                  total
                  currentPage
                  hasNextPage
              }
              media(sort: POPULARITY_DESC, type: ANIME) {
                  ${MEDIA_DATA}
              }
          } 
      }
      `;

  if (viewerId) {
    var headers: any = {
      Authorization: 'Bearer ' + STORE.get('access_token'),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  } else {
    var headers: any = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  const options = getOptions(query);
  const respData = await makeRequest(METHOD, GRAPH_QL_URL, headers, options);

  return respData.data.Page;
};

/**
 * Gets the next anime releases
 *
 * @returns object with next anime releases
 */
export const getNextReleases = async (viewerId: number | null) => {
  var query = `
      {
          Page(page: 1, perPage: ${PAGES}) {
              pageInfo {
                  total
                  currentPage
                  hasNextPage
              }
              media(status: NOT_YET_RELEASED, sort: POPULARITY_DESC, type: ANIME) {
                  ${MEDIA_DATA}
              }
          } 
      }
      `;

  if (viewerId) {
    var headers: any = {
      Authorization: 'Bearer ' + STORE.get('access_token'),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  } else {
    var headers: any = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  const options = getOptions(query);
  const respData = await makeRequest(METHOD, GRAPH_QL_URL, headers, options);

  return respData.data.Page;
};

/**
 * Gets searched anime with filters
 *
 * @param {*} args
 * @returns object with the searched filtered anime
 */
export const searchFilteredAnime = async (
  args: string,
  viewerId: number | null,
): Promise<AnimeData> => {
  var query = `
      {
          Page(page: 1, perPage: 50) {
              pageInfo {
                  total
                  currentPage
                  hasNextPage
              }
              media(${args}) {
                  ${MEDIA_DATA}
              }
          } 
      }
      `;

  if (viewerId) {
    var headers: any = {
      Authorization: 'Bearer ' + STORE.get('access_token'),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  } else {
    var headers: any = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  const options = getOptions(query);
  const respData = await makeRequest(METHOD, GRAPH_QL_URL, headers, options);

  return respData.data.Page;
};

/**
 * Gets the next anime releases
 *
 * @returns object with next anime releases
 */
export const releasingAnimes = async () => {
  var query = `
      {
          Page(page: 1, perPage: ${PAGES}) {
              pageInfo {
                  total
                  currentPage
                  hasNextPage
              }
              media(status: RELEASING, sort: POPULARITY_DESC, type: ANIME) {
                  ${MEDIA_DATA}
              }
          } 
      }
      `;

  const options = getOptions(query);
  const respData = await makeRequest(METHOD, GRAPH_QL_URL, HEADERS, options);

  return respData.data.Page;
};

/**
 * Gets the current trending animes filtered by a genre
 * pass viewerId to make an authenticated request
 *
 * @param {*} genre
 * @param {*} viewerId
 * @returns object with animes entries filtered by genre
 */
export const getAnimesByGenre = async (genre: any, viewerId: number | null) => {
  var query = `
      {
          Page(page: 1, perPage: ${PAGES}) {
              pageInfo {
                  total
                  currentPage
                  hasNextPage
              }
              media(genre: "${genre}", sort: TRENDING_DESC, type: ANIME) {
                  ${MEDIA_DATA}
              }
          } 
      }
      `;

  if (viewerId) {
    var headers: any = {
      Authorization: 'Bearer ' + STORE.get('access_token'),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  } else {
    var headers: any = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  const options = getOptions(query);
  const respData = await makeRequest(METHOD, GRAPH_QL_URL, headers, options);

  return respData.data.Page;
};

/**
 * Gets anime entries from a search query
 *
 * @param {*} input
 * @returns object with searched animes
 */
export const getSearchedAnimes = async (input: any) => {
  var query = `
      {
          Page(page: 1, perPage: ${PAGES}) {
              pageInfo {
                  total
                  currentPage
                  lastPage
                  hasNextPage
                  perPage
              }
              media(search: "${input}", type: ANIME, sort: SEARCH_MATCH) {
                  ${MEDIA_DATA}
              }
          }
      }
      `;

  const options = getOptions(query);
  const respData = await makeRequest(METHOD, GRAPH_QL_URL, HEADERS, options);

  return respData.data.Page.media;
};

/* MUTATIONS */

/**
 * Updates a media entry list
 *
 * @param mediaId
 * @param status
 * @param scoreRaw
 * @param progress
 * @returns media list entry id
 */
export const updateAnimeFromList = async (
  mediaId: any,
  status?: any,
  scoreRaw?: any,
  progress?: any,
): Promise<number | null> => {
  try {
    var query = `
          mutation($mediaId: Int${progress ? ', $progress: Int' : ''}${scoreRaw ? ', $scoreRaw: Int' : ''}${status ? ', $status: MediaListStatus' : ''}) {
              SaveMediaListEntry(mediaId: $mediaId${progress ? ', progress: $progress' : ''}${scoreRaw ? ', scoreRaw: $scoreRaw' : ''}${status ? ', status: $status' : ''}) {
                  id
              }
          }
      `;

    var headers = {
      Authorization: 'Bearer ' + STORE.get('access_token'),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    var variables: any = {
      mediaId: mediaId,
    };

    if (status !== undefined) variables.status = status;
    if (scoreRaw !== undefined) variables.scoreRaw = scoreRaw;
    if (progress !== undefined) variables.progress = progress;

    const options = getOptions(query, variables);
    const respData = await makeRequest(METHOD, GRAPH_QL_URL, headers, options);

    console.log(
      `Anime list updated (status: ${status},score: ${scoreRaw},progress: ${progress}) for list ${mediaId}`,
    );

    return respData.data.SaveMediaListEntry.id;
  } catch (error) {
    console.log(error);
    return null;
  }
};

export const deleteAnimeFromList = async (id: any): Promise<boolean> => {
  try {
    var query = `
          mutation($id: Int){
              DeleteMediaListEntry(id: $id){
                  deleted
              }
          }
      `;

    console.log('delte: ', id);

    var headers = {
      Authorization: 'Bearer ' + STORE.get('access_token'),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    var variables = {
      id: id,
    };

    const options = getOptions(query, variables);
    return await makeRequest(METHOD, GRAPH_QL_URL, headers, options);
  } catch (error) {
    console.log(error);
    return false;
  }
};

/**
 * Updates the progress of an anime on list
 *
 * @param {*} mediaId
 * @param {*} progress
 */
export const updateAnimeProgress = async (
  mediaId: number,
  progress: number,
) => {
  var query = `
          mutation($mediaId: Int, $progress: Int) {
              SaveMediaListEntry(mediaId: $mediaId, progress: $progress) {
                  id
                  progress
              }
          }
      `;

  var headers = {
    Authorization: 'Bearer ' + STORE.get('access_token'),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  var variables = {
    mediaId: mediaId,
    progress: progress,
  };

  const options = getOptions(query, variables);
  await makeRequest(METHOD, GRAPH_QL_URL, headers, options);

  console.log(`Progress updated (${progress}) for anime ${mediaId}`);
};
