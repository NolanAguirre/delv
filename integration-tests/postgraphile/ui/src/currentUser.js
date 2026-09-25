import {createContext, useContext} from 'react'

// Since there is no auth, the "current user" is just a switcher over the
// seeded users. App provides {userId, setUserId}; views read it here.
const CurrentUserContext = createContext({userId: null, setUserId: () => {}})

const useCurrentUser = () => useContext(CurrentUserContext)

export {CurrentUserContext, useCurrentUser}
