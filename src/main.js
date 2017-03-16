import 'babel-polyfill'
import http from 'http'
import OAuth2 from 'client-oauth2'
import JsonApi from 'devour-client'
import fetch from 'node-fetch'
import moment from 'moment'
import tz from 'moment-timezone'
import { CronJob } from 'cron'

const timeZone = 'Asia/Tokyo'

const baseUrl = process.env.KITSU_HOST + '/api'
const username = process.env.USER
const password = process.env.PASSWORD
const userId = process.env.USER_ID
const groupId = process.env.GROUP_ID
const malUrl = process.env.MAL_HOST + '/2.1'

const auth = new OAuth2({
  clientId: process.env.KITSU_CLIENT,
  clientSecret: process.env.KITSU_SECRET,
  accessTokenUri: baseUrl + '/oauth/token'
})

const Kitsu = new JsonApi({ apiUrl: baseUrl + '/edge', logger: false })
Kitsu.headers['User-Agent'] = 'AiringBot/1.0.0'

Kitsu.define('post', {
  content: '',
  nsfw: false,
  spoiler: false,
  media: {
    jsonApi: 'hasOne',
    type: 'anime'
  },
  spoiledUnit: {
    jsonApi: 'hasOne',
    type: 'episodes'
  },
  targetGroup: {
    jsonApi: 'hasOne',
    type: 'groups'
  },
  user: {
    jsonApi: 'hasOne',
    type: 'users'
  }
})

Kitsu.define('mapping', {
  externalSite: '',
  externalId: '',
  media: {
    jsonApi: 'hasOne',
    type: 'anime'
  }
})

Kitsu.define('anime', {
  episodes: {
    jsonApi: 'hasMany',
    type: 'episodes'
  }
})

Kitsu.define('episode', {
  number: '',
  synopsis: '',
  airdate: '',
  thumbnail: { original: '' }
})

Kitsu.define('libraryEntry', {
  status: '',
  progress: '',
  media: {
    jsonApi: 'hasOne',
    type: 'anime'
  },
  user: {
    jsonApi: 'hasOne',
    type: 'users'
  }
}, { collectionPath: 'library-entries' })

const main = async () => {
  let { accessToken } = await auth.owner.getToken(username, password)
  Kitsu.headers['Authorization'] = 'Bearer ' + accessToken

  let list = await fetch(malUrl + '/animelist/' + username).then(res => res.json()).then(json => json.anime)

  let day = moment().tz(timeZone).format('dddd').toLowerCase()
  let schedule = await fetch(malUrl + '/anime/schedule').then(res => res.json()).then(json => json[day])

  let malIds = schedule.filter((airing) => {
    let found = false;
    list.forEach((anime) => {
      if (anime.id == airing.id) {
        found = true
      }
    })
    return found;
  }).map(anime => anime.id)

  console.log('malIds: ')
  console.log(malIds)

  let kitsuIds = await Promise.all(malIds.map(async (malId) => {
    let mapping = await Kitsu.findAll('mapping', {
      filter: {
        externalSite: 'myanimelist/anime',
        externalId: malId
      },
      include: 'media',
      page: { limit: 1 }
    })
    return mapping[0].media.id
  }))

  console.log('kitsuIds:')
  console.log(kitsuIds)

  let library = await Promise.all(kitsuIds.map(async (mediaId) => {
    let entry = await Kitsu.findAll('libraryEntry', {
      filter: { userId, status: 'current', kind: 'anime', mediaId },
      page: { limit: 200 }
    })
    let { progress, id } = entry[0]
    return { animeId: mediaId, progress, entryId: id}
  }))

  console.log('library:')
  console.log(library)

  let airing = await Promise.all(library.map(async (entry) => {
    let { animeId, progress } = entry
    let episode = await Kitsu.findAll('episode', {
      filter: {
        mediaId: animeId,
        number: progress + 1
      }
    })[0]
    return { ...entry, episode }
  }))

  console.log('airing:')
  console.log(airing)

  airing.forEach(async (anime, i) => {
    let { animeId, progress, entryId } = anime
    let data = {
      content: "Episode " + (progress + 1),
      nsfw: false,
      spoiler: true,
      media: { id: animeId },
      targetGroup: { id: groupId },
      user: { id: userId }
    }
    if (anime.episode) {
      let { id, canonicalTitle, synopsis, thumbnail } = anime.episode
      data.spoiledUnit = { id }
      data.content += `: ${canonicalTitle}\n\nSynopsis: ${synopsis}\n\n${thumbnail.original}`
    }
    let post
    ((i) => {
      setTimeout(async () => {
        console.log(new Date().getSeconds())
        try { post = await Kitsu.create('post', data) }
        catch (error) {
          console.log(error)
          return
        }

        console.log('post:')
        console.log(post)

        let updatedEntry = await Kitsu.update('libraryEntry', { id: entryId, progress: progress + 1})

        console.log('updatedEntry:')
        console.log(updatedEntry)
      }, 25000 * i)
    })(i)
  })
}

new CronJob('00 00 00 * * *', main, () => {}, true, timeZone)

let port = process.env.PORT || 3000
const server = http.createServer((request, response) => {
  response.write('healthy')
  response.end()
})
server.listen(port)
console.log('server running on port: ' + port)
