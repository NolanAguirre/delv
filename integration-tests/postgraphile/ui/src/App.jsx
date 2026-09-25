import React, {useEffect, useState} from 'react'
import {useQuery} from 'delv/react'
import {USERS_QUERY} from './queries.js'
import {CurrentUserContext} from './currentUser.js'
import Books from './components/Books.jsx'
import Genres from './components/Genres.jsx'
import Authors from './components/Authors.jsx'
import AccountSettings from './components/AccountSettings.jsx'
import Checkouts from './components/Checkouts.jsx'
import AccountMenu from './components/AccountMenu.jsx'

const NAV_TABS = [
    {view: 'books', label: 'Books'},
    {view: 'genres', label: 'Genres'},
    {view: 'authors', label: 'Authors'}
]

const VIEW_TITLES = {
    books: 'Books',
    genres: 'Genres',
    authors: 'Authors',
    settings: 'Account settings',
    checkouts: 'Checkouts'
}

const renderView = (view) => {
    if(view === 'genres'){
        return <Genres />
    }
    if(view === 'authors'){
        return <Authors />
    }
    if(view === 'settings'){
        return <AccountSettings />
    }
    if(view === 'checkouts'){
        return <Checkouts />
    }
    return <Books />
}

const App = () => {
    const [view, setView] = useState('books')
    const [userId, setUserId] = useState(null)

    // Default the current user to the first user the API returns.
    const {data} = useQuery({query: USERS_QUERY})
    useEffect(() => {
        const users = (data && data.allUsers && data.allUsers.nodes) || []
        if(!userId && users.length){
            setUserId(users[0].id)
        }
    }, [data, userId])

    return (
        <CurrentUserContext.Provider value={{userId, setUserId}}>
            <main style={{fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '2rem auto', padding: '0 1rem'}}>
                <header style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '0.75rem'}}>
                    <div style={{display: 'flex', alignItems: 'baseline', gap: '1rem'}}>
                        <h1 style={{margin: 0}}>lbry</h1>
                        <nav style={{display: 'flex', gap: '0.5rem'}}>
                            {NAV_TABS.map((tab) => (
                                <button
                                    key={tab.view}
                                    type="button"
                                    onClick={() => setView(tab.view)}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        fontWeight: view === tab.view ? 700 : 400,
                                        textDecoration: view === tab.view ? 'underline' : 'none'
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <AccountMenu onNavigate={setView} />
                </header>
                <section style={{marginTop: '1.5rem'}}>
                    <h2>{VIEW_TITLES[view]}</h2>
                    {renderView(view)}
                </section>
            </main>
        </CurrentUserContext.Provider>
    )
}

export default App
