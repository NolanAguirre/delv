import React, {useEffect, useState} from 'react'
import {useQuery, useMutation} from 'delv/react'
import {USERS_QUERY, UPDATE_USER} from '../queries.js'
import {useCurrentUser} from '../currentUser.js'

const AccountSettings = () => {
    const {userId} = useCurrentUser()
    const {loading, error, data} = useQuery({query: USERS_QUERY})
    const [updateUser, {loading: saving, error: saveError}] = useMutation({mutation: UPDATE_USER})

    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [saved, setSaved] = useState(false)

    const users = (data && data.allUsers && data.allUsers.nodes) || []
    const user = users.find((candidate) => candidate.id === userId)

    useEffect(() => {
        if(user){
            setFullName(user.fullName || '')
            setEmail(user.email || '')
        }
    }, [user && user.id])

    if(loading){
        return <p>Loading account…</p>
    }
    if(error){
        return <p style={{color: 'crimson'}}>Error loading account: {String(error.message || error)}</p>
    }
    if(!user){
        return <p>No user selected.</p>
    }

    const onSubmit = (event) => {
        event.preventDefault()
        setSaved(false)
        updateUser({variables: {id: user.id, patch: {fullName, email}}})
            .then(() => setSaved(true))
            .catch(() => {})
    }

    return (
        <form onSubmit={onSubmit} style={{display: 'grid', gap: '0.75rem', maxWidth: 360}}>
            <label style={{display: 'grid', gap: '0.25rem'}}>
                <span>Username</span>
                <input value={user.username} disabled />
            </label>
            <label style={{display: 'grid', gap: '0.25rem'}}>
                <span>Full name</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>
            <label style={{display: 'grid', gap: '0.25rem'}}>
                <span>Email</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <div>
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                {saved ? <span style={{marginLeft: 8, color: 'green'}}>Saved</span> : null}
            </div>
            {saveError ? <p style={{color: 'crimson'}}>Error saving: {String(saveError.message || saveError)}</p> : null}
        </form>
    )
}

export default AccountSettings
