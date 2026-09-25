import React, {useState} from 'react'
import {useQuery, useMutation} from 'delv/react'
import {AUTHORS_QUERY, CREATE_AUTHOR, UPDATE_AUTHOR, DELETE_AUTHOR} from '../queries.js'

const AuthorRow = ({author, onDelete, deleting}) => {
    const [updateAuthor, {loading: saving}] = useMutation({mutation: UPDATE_AUTHOR})
    const [editing, setEditing] = useState(false)
    const [firstName, setFirstName] = useState(author.firstName)
    const [lastName, setLastName] = useState(author.lastName)
    const [bio, setBio] = useState(author.bio || '')

    const onSave = () => {
        updateAuthor({variables: {id: author.id, patch: {firstName, lastName, bio}}})
            .then(() => setEditing(false))
            .catch(() => {})
    }

    const onCancel = () => {
        setFirstName(author.firstName)
        setLastName(author.lastName)
        setBio(author.bio || '')
        setEditing(false)
    }

    return (
        <li>
            {editing ? (
                <span style={{display: 'inline-flex', gap: '0.25rem', flexWrap: 'wrap'}}>
                    <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" />
                    <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" />
                    <input value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Bio" />
                    <button type="button" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                    <button type="button" onClick={onCancel}>Cancel</button>
                </span>
            ) : (
                <span>
                    <strong>{author.firstName} {author.lastName}</strong>
                    {author.bio ? ` — ${author.bio}` : ''}
                    <button type="button" onClick={() => setEditing(true)} style={{marginLeft: 8}}>Edit</button>
                    <button type="button" onClick={() => onDelete(author.id)} disabled={deleting} style={{marginLeft: 4}}>Delete</button>
                </span>
            )}
        </li>
    )
}

const NewAuthorForm = () => {
    const [createAuthor, {loading, error}] = useMutation({mutation: CREATE_AUTHOR})
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [bio, setBio] = useState('')

    const onSubmit = (event) => {
        event.preventDefault()
        if(!firstName || !lastName){
            return
        }
        const author = {firstName, lastName}
        if(bio){
            author.bio = bio
        }
        createAuthor({variables: {author}})
            .then(() => {
                setFirstName('')
                setLastName('')
                setBio('')
            })
            .catch(() => {})
    }

    return (
        <form onSubmit={onSubmit} style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem'}}>
            <input placeholder="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            <input placeholder="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            <input placeholder="Bio" value={bio} onChange={(event) => setBio(event.target.value)} />
            <button type="submit" disabled={loading}>{loading ? 'Adding…' : 'Add author'}</button>
            {error ? <span style={{color: 'crimson'}}>{String(error.message || error)}</span> : null}
        </form>
    )
}

const Authors = () => {
    const {loading, error, data} = useQuery({query: AUTHORS_QUERY})
    const [deleteAuthor, {loading: deleting, error: deleteError}] = useMutation({mutation: DELETE_AUTHOR})

    const onDelete = (id) => {
        deleteAuthor({variables: {id}}).catch(() => {})
    }

    if(loading){
        return <p>Loading authors…</p>
    }
    if(error){
        return <p style={{color: 'crimson'}}>Error loading authors: {String(error.message || error)}</p>
    }

    const authors = (data && data.allAuthors && data.allAuthors.nodes) || []

    return (
        <div>
            <NewAuthorForm />
            {deleteError ? <p style={{color: 'crimson'}}>Error deleting: {String(deleteError.message || deleteError)}</p> : null}
            <ul>
                {authors.map((author) => (
                    <AuthorRow key={author.id} author={author} onDelete={onDelete} deleting={deleting} />
                ))}
            </ul>
        </div>
    )
}

export default Authors
