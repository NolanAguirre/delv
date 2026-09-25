import React, {useState} from 'react'
import {DelvQuery} from 'delv/react'
import {USERS_QUERY} from '../queries.js'
import {useCurrentUser} from '../currentUser.js'

const AccountMenu = ({onNavigate}) => {
    const {userId, setUserId} = useCurrentUser()
    const [open, setOpen] = useState(false)

    const go = (view) => {
        setOpen(false)
        onNavigate(view)
    }

    return (
        <DelvQuery query={USERS_QUERY}>
            {({loading, error, data}) => {
                if(loading){
                    return <span>…</span>
                }
                if(error){
                    return <span style={{color: 'crimson'}}>Error</span>
                }
                const users = (data && data.allUsers && data.allUsers.nodes) || []
                const current = users.find((user) => user.id === userId) || users[0]
                return (
                    <div style={{position: 'relative', display: 'inline-block'}}>
                        <button type="button" onClick={() => setOpen((prev) => !prev)}>
                            {current ? current.fullName || current.username : 'Account'} ▾
                        </button>
                        {open ? (
                            <div
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    marginTop: 4,
                                    background: '#fff',
                                    border: '1px solid #ccc',
                                    borderRadius: 6,
                                    minWidth: 200,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    zIndex: 10
                                }}
                            >
                                <div style={{padding: '0.5rem 0.75rem', fontSize: 12, color: '#666'}}>Switch user</div>
                                {users.map((user) => (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => {
                                            setUserId(user.id)
                                            setOpen(false)
                                        }}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '0.4rem 0.75rem',
                                            border: 'none',
                                            background: user.id === (current && current.id) ? '#eef' : 'transparent',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {user.fullName || user.username}
                                    </button>
                                ))}
                                <hr style={{margin: '0.25rem 0', border: 'none', borderTop: '1px solid #eee'}} />
                                <button
                                    type="button"
                                    onClick={() => go('settings')}
                                    style={{display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.75rem', border: 'none', background: 'transparent', cursor: 'pointer'}}
                                >
                                    Account settings
                                </button>
                                <button
                                    type="button"
                                    onClick={() => go('checkouts')}
                                    style={{display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.75rem', border: 'none', background: 'transparent', cursor: 'pointer'}}
                                >
                                    Checkouts
                                </button>
                            </div>
                        ) : null}
                    </div>
                )
            }}
        </DelvQuery>
    )
}

export default AccountMenu
