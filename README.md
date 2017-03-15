### How it works

The script uses bot accounts on MyAnimeList and Kitsu. Both need to add tracked shows to their currently watching library. The script will then find tracked shows that are airing every day from MAL, and match them to their Kitsu counterparts. It will then create the group post with a spoiler tag, and episode information if it exists on Kitsu, and increment the progress on the bot's library entries.

### Development

- Set environment variables
    - `KITSU_HOST` (https://kitsu.io)
    - `USER` (bot Kitsu username)
    - `PASSWORD` (bot Kitsu password)
    - `USER_ID` (bot Kitsu user id number)
    - `GROUP_ID` (Kitsu group id number)
    - `MAL_HOST` (Atarashii api host)
    - `KITSU_CLIENT` (Kitsu api client id)
    - `KITSU_SECRET` (Kitsu api client secret)
- `npm install && npm run start`
