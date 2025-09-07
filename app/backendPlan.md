Backend Plan:

- there's a room
- the room as a hostId
- the host can "ready" the room when it's controllabe. the host will write their peer id to a specific place that only the server can see
- when a client wants control, they request control from the server
- server writes request to a table of control requests
- host listens to the requests table, and shows UI that a client has requested
- host approves request on ui side, tells the server to approve client request
- client polls server for request approval, which will return the host's peer id
- when a call is finished, the host will generate a new peer-id, and inform the server

rooms table {roomId, hostId, hostPeerId, currentControllingClientId, requestingIds}

/hostIsReadyForControl (hostId, roomId, peerId)
check authenticity
create a room table if it doesn't exist
write host id
write peer id
set currentControllingClientId to null

/requestControl (clientId, roomId)
check authenticity
add to requestingIds

/approveClientRequest (hostId, roomId, clientId)
check authenticity
set currentControllingClientId to clientId

/requestRoomPeerId (clientId, roomId)
check authenticity
if clientId matches currentControllingId, return the hostPeerId
