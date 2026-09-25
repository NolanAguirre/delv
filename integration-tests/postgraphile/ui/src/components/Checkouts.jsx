import React from 'react'
import {DelvQuery, useMutation} from 'delv/react'
import {CHECKOUTS_QUERY, CHECKOUT_HISTORY_QUERY, RETURN_CHECKOUT} from '../queries.js'
import {useCurrentUser} from '../currentUser.js'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '')

const ActiveCheckouts = ({userId}) => {
    const [returnCheckout, {loading: returning}] = useMutation({mutation: RETURN_CHECKOUT})

    // returnCheckout moves the row from checkout -> checkout_history, so BOTH
    // lists change membership. Refetch both so active drops it and history gains it.
    const onReturn = (checkoutId) => {
        returnCheckout({
            variables: {checkoutId},
            refetchQueries: [
                {query: CHECKOUTS_QUERY, variables: {userId}},
                {query: CHECKOUT_HISTORY_QUERY, variables: {userId}}
            ]
        }).catch(() => {})
    }

    return (
        <DelvQuery query={CHECKOUTS_QUERY} variables={{userId}}>
            {({loading, error, data}) => {
                if(loading){
                    return <p>Loading checkouts…</p>
                }
                if(error){
                    return <p style={{color: 'crimson'}}>Error loading checkouts: {String(error.message || error)}</p>
                }
                const checkouts = (data && data.allCheckouts && data.allCheckouts.nodes) || []
                if(!checkouts.length){
                    return <p><em>No active checkouts.</em></p>
                }
                return (
                    <ul>
                        {checkouts.map((checkout) => {
                            const copy = checkout.bookCopyByBookCopyId
                            const book = copy && copy.bookByBookId
                            return (
                                <li key={checkout.id} style={{marginBottom: '0.5rem'}}>
                                    <strong>{book ? book.title : 'Unknown'}</strong>
                                    {copy ? ` (${copy.barcode})` : ''}
                                    {' — due '}{formatDate(checkout.dueAt)}
                                    <button
                                        type="button"
                                        onClick={() => onReturn(checkout.id)}
                                        disabled={returning}
                                        style={{marginLeft: 8}}
                                    >
                                        Return
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )
            }}
        </DelvQuery>
    )
}

const CheckoutHistory = ({userId}) => (
    <DelvQuery query={CHECKOUT_HISTORY_QUERY} variables={{userId}}>
        {({loading, error, data}) => {
            if(loading){
                return <p>Loading history…</p>
            }
            if(error){
                return <p style={{color: 'crimson'}}>Error loading history: {String(error.message || error)}</p>
            }
            const history = (data && data.allCheckoutHistories && data.allCheckoutHistories.nodes) || []
            if(!history.length){
                return <p><em>No checkout history.</em></p>
            }
            return (
                <ul>
                    {history.map((entry) => {
                        const copy = entry.bookCopyByBookCopyId
                        const book = copy && copy.bookByBookId
                        return (
                            <li key={entry.id}>
                                <strong>{book ? book.title : 'Unknown'}</strong>
                                {copy ? ` (${copy.barcode})` : ''}
                                {' — returned '}{formatDate(entry.returnedAt)}
                            </li>
                        )
                    })}
                </ul>
            )
        }}
    </DelvQuery>
)

const Checkouts = () => {
    const {userId} = useCurrentUser()
    if(!userId){
        return <p>No user selected.</p>
    }
    return (
        <div>
            <h3>Active</h3>
            <ActiveCheckouts userId={userId} />
            <h3>History</h3>
            <CheckoutHistory userId={userId} />
        </div>
    )
}

export default Checkouts
