# Soul-Knot Server

This is the backend server for **Soul-Knot**, a matrimony platform connecting users with potential life partners. Built using Node.js, Express.js, and MongoDB, the server handles authentication, biodata management, Stripe payments, and admin functionality to support the frontend.

## Live Server
- [Server Site URL](https://soul-knot-server.vercel.app)

## Live Site
- [Live Site URL](https://soul-knot.web.app)

---

## Features

### Authentication
- Email/password authentication with JSON Web Token (JWT).
- Google Sign-in integration.
- Middleware-protected routes for secure access.
- Role-based access control for users and admins.

### Biodata Management
- APIs to create, update, and delete biodata.
- Filter and sort biodata by age, gender, and division.
- Dynamic ID generation for biodata entries.

### Premium Membership
- API for handling premium membership requests.
- Admin approval system for premium status upgrades.

### Contact Information Requests
- Users can request access to biodata contact information for $5.
- Admin can approve or decline requests.
- Notifications for both users and admins.

### Dashboard APIs
#### Normal User:
- **Edit Biodata**: APIs to create or update biodata.
- **View Biodata**: Fetch biodata details for the logged-in user.
- **Contact Requests**: View the status of all contact requests.
- **Favourite Biodata**: Add or remove biodata entries from favourites.

#### Admin:
- **Dashboard Overview**: Total biodata, premium members, and revenue statistics.
- **Manage Users**: Approve, block, or delete users.
- **Approve Premium Memberships**: APIs for handling premium requests.
- **Contact Information Requests**: Approve or decline user requests for biodata contact details.

### Notifications
- Real-time updates for approvals and CRUD operations using WebSocket/Socket.IO (optional).
- Sweet alerts/toasts integration on the frontend.

---

## Technologies Used
- **Backend Framework:** Node.js, Express.js
- **Database:** MongoDB
- **Authentication:** JSON Web Token (JWT)
- **Payment Gateway:** Stripe
- **Environment Management:** dotenv
- **API Testing:** Postman

---

## Environment Variables
Ensure the following environment variables are set in a `.env` file:

### MongoDB and JWT
```env
MONGO_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret-key>