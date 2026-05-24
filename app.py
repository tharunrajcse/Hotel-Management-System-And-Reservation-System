import os
import pickle
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from sklearn.preprocessing import LabelEncoder
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)
app.secret_key = 'hotel_booking_secret_key_d_drive'
CORS(app, supports_credentials=True)

# Database configuration (stored on D drive workspace)
db_path = os.path.join(os.path.dirname(__file__), 'hotels.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Paths for models and datasets (on D drive workspace)
DATASET_PATH = r"d:\download movies\hotel booking\Dataset .csv"
MODELS_DIR = r"d:\download movies\hotel booking\models-usage"

# Global model variables
similarity_matrix = None
rating_model = None
df_csv = None
label_encoders = {}

# Beautiful Curated Unsplash Hotel Room Images
HOTEL_IMAGES = [
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80"
]

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), default='user') # 'user' or 'admin'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Hotel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    original_index = db.Column(db.Integer, nullable=True) # Maps to similarity matrix index
    name = db.Column(db.String(150), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(300), nullable=True)
    locality = db.Column(db.String(150), nullable=True)
    cuisines = db.Column(db.String(300), nullable=True) # Treated as amenities
    average_cost = db.Column(db.Float, nullable=True)
    currency = db.Column(db.String(50), nullable=True)
    price_range = db.Column(db.Integer, nullable=True) # 1 to 4
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    aggregate_rating = db.Column(db.Float, default=0.0)
    rating_color = db.Column(db.String(50), default='White')
    rating_text = db.Column(db.String(50), default='Not rated')
    votes = db.Column(db.Integer, default=0)
    available_rooms = db.Column(db.Integer, default=5)
    image_url = db.Column(db.String(500), nullable=True)
    is_deleted = db.Column(db.Boolean, default=False)

class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    hotel_id = db.Column(db.Integer, db.ForeignKey('hotel.id'), nullable=False)
    room_type = db.Column(db.String(50), nullable=False) # 'Standard', 'Deluxe', 'Suite'
    check_in_date = db.Column(db.String(50), nullable=False)
    check_out_date = db.Column(db.String(50), nullable=False)
    total_price = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='pending') # 'pending', 'approved', 'rejected', 'cancelled'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref=db.backref('bookings', lazy=True))
    hotel = db.relationship('Hotel', backref=db.backref('bookings', lazy=True))

class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    hotel_id = db.Column(db.Integer, db.ForeignKey('hotel.id'), nullable=False)
    rating = db.Column(db.Float, nullable=False)
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('reviews', lazy=True))
    hotel = db.relationship('Hotel', backref=db.backref('reviews', lazy=True))

# ----------------- Models & Data Seeding -----------------
def load_ml_models_and_data():
    global similarity_matrix, rating_model, df_csv, label_encoders
    print("Loading models and dataset...")
    
    # 1. Load CSV
    if os.path.exists(DATASET_PATH):
        df_csv = pd.read_csv(DATASET_PATH)
        print("CSV loaded successfully.")
    else:
        print("CRITICAL: Dataset CSV not found at", DATASET_PATH)
        return False
        
    # 2. Load Similarity Matrix
    sim_path = os.path.join(MODELS_DIR, "similarity.pkl")
    if os.path.exists(sim_path):
        with open(sim_path, 'rb') as f:
            similarity_matrix = pickle.load(f)
        print("Similarity matrix loaded.")
    else:
        print("CRITICAL: similarity.pkl not found at", sim_path)
        return False

    # 3. Load Rating Decision Tree Model
    model_path = os.path.join(MODELS_DIR, "rating_model.pkl")
    if os.path.exists(model_path):
        with open(model_path, 'rb') as f:
            rating_model = pickle.load(f)
        print("Rating model loaded successfully.")
    else:
        print("CRITICAL: rating_model.pkl not found at", model_path)
        return False

    # 4. Train LabelEncoders on alphabetical order for all categorical columns
    categorical_cols = [
        'City', 'Cuisines', 'Currency', 'Has Table booking',
        'Has Online delivery', 'Is delivering now', 'Switch to order menu',
        'Rating color', 'Rating text'
    ]
    for col in categorical_cols:
        le = LabelEncoder()
        # Ensure we have string values and sort alphabetically
        df_csv[col] = df_csv[col].fillna("Unknown").astype(str)
        le.fit(sorted(df_csv[col].unique()))
        label_encoders[col] = le
    print("Label encoders initialized on original CSV classes.")
    return True

def seed_database_if_empty():
    db.create_all()
    
    # Check if admin user exists, if not create a default one
    admin = User.query.filter_by(username='admin').first()
    if not admin:
        default_admin = User(
            username='admin',
            password_hash=generate_password_hash('admin123'),
            email='admin@hotelbooking.com',
            role='admin'
        )
        db.session.add(default_admin)
        print("Default admin created (username: admin, password: admin123).")

    # Check if hotels table is populated
    if Hotel.query.count() == 0:
        print("Seeding database with hotels from Zomato CSV. This might take a moment...")
        hotels_to_insert = []
        for idx, row in df_csv.iterrows():
            img_url = HOTEL_IMAGES[idx % len(HOTEL_IMAGES)]
            
            # Map Has Table booking to available rooms count for nice variance
            rooms = 8 if row['Has Table booking'] == 'Yes' else 4
            
            hotel = Hotel(
                id=int(idx) + 1, # SQLite IDs start at 1
                original_index=int(idx),
                name=row['Restaurant Name'],
                city=row['City'],
                address=row['Address'],
                locality=row['Locality'],
                cuisines=row['Cuisines'],
                average_cost=float(row['Average Cost for two']),
                currency=row['Currency'],
                price_range=int(row['Price range']),
                latitude=float(row['Longitude']) if abs(float(row['Longitude'])) < 90 else float(row['Latitude']), # Safeguard lat/lng if inverted
                longitude=float(row['Latitude']) if abs(float(row['Longitude'])) < 90 else float(row['Longitude']),
                aggregate_rating=float(row['Aggregate rating']),
                rating_color=row['Rating color'],
                rating_text=row['Rating text'],
                votes=int(row['Votes']),
                available_rooms=rooms,
                image_url=img_url,
                is_deleted=False
            )
            hotels_to_insert.append(hotel)
            
            # Bulk save in chunks of 1000 for efficiency
            if len(hotels_to_insert) >= 1000:
                db.session.bulk_save_objects(hotels_to_insert)
                db.session.commit()
                hotels_to_insert = []
                
        if hotels_to_insert:
            db.session.bulk_save_objects(hotels_to_insert)
            db.session.commit()
            
        print(f"Database seeded with {Hotel.query.count()} hotels successfully!")

# ----------------- APIs -----------------

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

# 1. User Authentication APIs
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    role = data.get('role', 'user') # 'user' or 'admin'

    if not username or not password or not email:
        return jsonify({'error': 'All fields are required.'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists.'}), 400

    hashed_pw = generate_password_hash(password)
    new_user = User(username=username, password_hash=hashed_pw, email=email, role=role)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'User registered successfully!'}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user') # Expect role alignment

    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials.'}), 401

    if user.role != role:
        return jsonify({'error': f'Invalid login role. Expected {role}.'}), 403

    session['user_id'] = user.id
    session['username'] = user.username
    session['role'] = user.role

    return jsonify({
        'message': 'Login successful!',
        'user': {
            'id': user.id,
            'username': user.username,
            'role': user.role,
            'email': user.email
        }
    }), 200

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully.'}), 200

@app.route('/api/auth/session', methods=['GET'])
def get_session():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({
                'logged_in': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'role': user.role,
                    'email': user.email
                }
            })
    return jsonify({'logged_in': False}), 200

# 2. Hotel APIs
@app.route('/api/hotels', methods=['GET'])
def get_hotels():
    search = request.args.get('search', '')
    city = request.args.get('city', '')
    min_rating = request.args.get('min_rating', 0, type=float)
    max_price = request.args.get('max_price', 1000000, type=float)
    sort_by = request.args.get('sort_by', 'rating') # 'rating', 'price_asc', 'price_desc', 'votes'
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 12, type=int)

    query = Hotel.query.filter(Hotel.is_deleted == False)

    if search:
        query = query.filter(Hotel.name.ilike(f'%{search}%') | Hotel.cuisines.ilike(f'%{search}%'))
    if city:
        query = query.filter(Hotel.city.ilike(f'%{city}%'))
    if min_rating:
        query = query.filter(Hotel.aggregate_rating >= min_rating)
    if max_price:
        query = query.filter(Hotel.average_cost <= max_price)

    # Sorting logic
    if sort_by == 'rating':
        query = query.order_by(Hotel.aggregate_rating.desc())
    elif sort_by == 'price_asc':
        query = query.order_by(Hotel.average_cost.asc())
    elif sort_by == 'price_desc':
        query = query.order_by(Hotel.average_cost.desc())
    elif sort_by == 'votes':
        query = query.order_by(Hotel.votes.desc())

    paginated_hotels = query.paginate(page=page, per_page=per_page, error_out=False)
    
    hotels_list = []
    for h in paginated_hotels.items:
        hotels_list.append({
            'id': h.id,
            'name': h.name,
            'city': h.city,
            'address': h.address,
            'locality': h.locality,
            'cuisines': h.cuisines,
            'average_cost': h.average_cost,
            'currency': h.currency,
            'price_range': h.price_range,
            'latitude': h.latitude,
            'longitude': h.longitude,
            'aggregate_rating': h.aggregate_rating,
            'rating_color': h.rating_color,
            'rating_text': h.rating_text,
            'votes': h.votes,
            'available_rooms': h.available_rooms,
            'image_url': h.image_url
        })

    return jsonify({
        'hotels': hotels_list,
        'page': page,
        'per_page': per_page,
        'total': paginated_hotels.total,
        'pages': paginated_hotels.pages
    })

@app.route('/api/hotels/cities', methods=['GET'])
def get_cities():
    # Fetch top 15 cities with most hotels
    cities = db.session.query(Hotel.city, db.func.count(Hotel.id).label('count'))\
                       .filter(Hotel.is_deleted == False)\
                       .group_by(Hotel.city)\
                       .order_by(db.desc('count'))\
                       .limit(15).all()
    return jsonify([c[0] for c in cities])

@app.route('/api/hotels/<int:hotel_id>', methods=['GET'])
def get_hotel_detail(hotel_id):
    hotel = Hotel.query.get_or_404(hotel_id)
    if hotel.is_deleted:
        return jsonify({'error': 'Hotel not found.'}), 404
        
    # Get reviews for this hotel
    reviews = Review.query.filter_by(hotel_id=hotel_id).order_by(Review.created_at.desc()).all()
    reviews_list = [{
        'username': r.user.username,
        'rating': r.rating,
        'comment': r.comment,
        'created_at': r.created_at.strftime('%Y-%m-%d %H:%M')
    } for r in reviews]

    return jsonify({
        'id': hotel.id,
        'name': hotel.name,
        'city': hotel.city,
        'address': hotel.address,
        'locality': hotel.locality,
        'cuisines': hotel.cuisines,
        'average_cost': hotel.average_cost,
        'currency': hotel.currency,
        'price_range': hotel.price_range,
        'latitude': hotel.latitude,
        'longitude': hotel.longitude,
        'aggregate_rating': hotel.aggregate_rating,
        'rating_color': hotel.rating_color,
        'rating_text': hotel.rating_text,
        'votes': hotel.votes,
        'available_rooms': hotel.available_rooms,
        'image_url': hotel.image_url,
        'reviews': reviews_list
    })

# 3. Intelligent ML Recommendation APIs
@app.route('/api/hotels/<int:hotel_id>/recommendations', methods=['GET'])
def get_similar_recommendations(hotel_id):
    hotel = Hotel.query.get_or_404(hotel_id)
    if hotel.original_index is None:
        # If no similarity matrix index (e.g. newly created admin hotel), recommend by same city & cuisines
        sim_hotels = Hotel.query.filter(Hotel.city == hotel.city, Hotel.id != hotel.id, Hotel.is_deleted == False)\
                                .order_by(Hotel.aggregate_rating.desc()).limit(6).all()
    else:
        idx = hotel.original_index
        # Get similarity values from the loaded matrix
        sim_scores = similarity_matrix[idx]
        # Sort scores in descending order and filter
        sim_indices = np.argsort(sim_scores)[::-1][1:50] # Get top 50 to filter out deleted/same items
        
        sim_hotels = []
        for s_idx in sim_indices:
            s_hotel = Hotel.query.filter_by(original_index=int(s_idx), is_deleted=False).first()
            if s_hotel and s_hotel.id != hotel.id:
                sim_hotels.append(s_hotel)
                if len(sim_hotels) >= 6:
                    break
                    
    rec_list = [{
        'id': h.id,
        'name': h.name,
        'city': h.city,
        'cuisines': h.cuisines,
        'average_cost': h.average_cost,
        'currency': h.currency,
        'aggregate_rating': h.aggregate_rating,
        'image_url': h.image_url
    } for h in sim_hotels]
    
    return jsonify(rec_list)

@app.route('/api/recommendations/personalized', methods=['GET'])
def get_personalized_recommendations():
    # If user has past bookings, suggest similar hotels based on the last booked hotel
    # Otherwise suggest top rated hotels in their last filtered city or default high rated hotels
    user_id = session.get('user_id')
    if not user_id:
        # Return popular hotels as default fallback
        popular_hotels = Hotel.query.filter(Hotel.is_deleted == False, Hotel.aggregate_rating >= 4.0)\
                                    .order_by(Hotel.votes.desc()).limit(6).all()
        rec_list = [{
            'id': h.id,
            'name': h.name,
            'city': h.city,
            'cuisines': h.cuisines,
            'average_cost': h.average_cost,
            'currency': h.currency,
            'aggregate_rating': h.aggregate_rating,
            'image_url': h.image_url
        } for h in popular_hotels]
        return jsonify({'type': 'popular', 'hotels': rec_list})

    # Get last successful booking
    last_booking = Booking.query.filter_by(user_id=user_id, status='approved')\
                                .order_by(Booking.created_at.desc()).first()
    if not last_booking:
        # Fallback to general user top rated recommendations
        top_rated = Hotel.query.filter(Hotel.is_deleted == False)\
                               .order_by(Hotel.aggregate_rating.desc())\
                               .limit(6).all()
        rec_list = [{
            'id': h.id,
            'name': h.name,
            'city': h.city,
            'cuisines': h.cuisines,
            'average_cost': h.average_cost,
            'currency': h.currency,
            'aggregate_rating': h.aggregate_rating,
            'image_url': h.image_url
        } for h in top_rated]
        return jsonify({'type': 'general', 'hotels': rec_list})

    # Recommend based on similarity to their last booked hotel
    base_hotel = last_booking.hotel
    if base_hotel.original_index is None:
        similar_hotels = Hotel.query.filter(Hotel.city == base_hotel.city, Hotel.id != base_hotel.id, Hotel.is_deleted == False)\
                                    .order_by(Hotel.aggregate_rating.desc()).limit(6).all()
    else:
        idx = base_hotel.original_index
        sim_scores = similarity_matrix[idx]
        sim_indices = np.argsort(sim_scores)[::-1][1:50]
        similar_hotels = []
        for s_idx in sim_indices:
            s_hotel = Hotel.query.filter_by(original_index=int(s_idx), is_deleted=False).first()
            if s_hotel and s_hotel.id != base_hotel.id:
                similar_hotels.append(s_hotel)
                if len(similar_hotels) >= 6:
                    break

    rec_list = [{
        'id': h.id,
        'name': h.name,
        'city': h.city,
        'cuisines': h.cuisines,
        'average_cost': h.average_cost,
        'currency': h.currency,
        'aggregate_rating': h.aggregate_rating,
        'image_url': h.image_url
    } for h in similar_hotels]

    return jsonify({
        'type': 'personalized',
        'base_hotel': base_hotel.name,
        'hotels': rec_list
    })

# 4. Rating Prediction API (using DecisionTreeRegressor rating_model.pkl)
@app.route('/api/hotels/predict-rating', methods=['POST'])
def predict_hotel_rating():
    data = request.json
    
    # Extract values with safe defaults matching rating_model structure
    try:
        country_code = int(data.get('country_code', 1))
        city = data.get('city', 'New Delhi')
        longitude = float(data.get('longitude', 77.2))
        latitude = float(data.get('latitude', 28.6))
        cuisines = data.get('cuisines', 'North Indian')
        avg_cost = float(data.get('average_cost', 500))
        currency = data.get('currency', 'Indian Rupees(Rs.)')
        has_table = data.get('has_table_booking', 'No')
        has_online = data.get('has_online_delivery', 'No')
        is_delivering = data.get('is_delivering_now', 'No')
        switch_menu = data.get('switch_to_order_menu', 'No')
        price_range = int(data.get('price_range', 2))
        rating_color = data.get('rating_color', 'Orange')
        rating_text = data.get('rating_text', 'Average')
        votes = int(data.get('votes', 50))
        
        # Build features dataframe matching exact input shape
        features_dict = {
            'Country Code': [country_code],
            'City': [city],
            'Longitude': [longitude],
            'Latitude': [latitude],
            'Cuisines': [cuisines],
            'Average Cost for two': [avg_cost],
            'Currency': [currency],
            'Has Table booking': [has_table],
            'Has Online delivery': [has_online],
            'Is delivering now': [is_delivering],
            'Switch to order menu': [switch_menu],
            'Price range': [price_range],
            'Rating color': [rating_color],
            'Rating text': [rating_text],
            'Votes': [votes]
        }
        
        df_feat = pd.DataFrame(features_dict)
        
        # Apply trained label encoders with fallback for unseen labels
        for col, le in label_encoders.items():
            val = str(df_feat[col].iloc[0])
            if val in le.classes_:
                df_feat[col] = le.transform([val])
            else:
                # If unseen category, fallback to first class
                df_feat[col] = le.transform([le.classes_[0]])
                
        # Predict using Loaded Decision Tree
        predicted_rating = rating_model.predict(df_feat)[0]
        
        # Clip between 0.0 and 5.0 just in case
        predicted_rating = float(np.clip(predicted_rating, 0.0, 5.0))
        
        return jsonify({
            'predicted_rating': round(predicted_rating, 1),
            'rating_text': 'Excellent' if predicted_rating >= 4.5 else 'Very Good' if predicted_rating >= 4.0 else 'Good' if predicted_rating >= 3.5 else 'Average' if predicted_rating >= 2.5 else 'Poor' if predicted_rating > 0 else 'Not rated'
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to run model prediction: {str(e)}'}), 400

# 5. User Bookings & Reviews APIs
@app.route('/api/bookings', methods=['POST'])
def create_booking():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Please login to reserve rooms.'}), 401
        
    data = request.json
    hotel_id = data.get('hotel_id')
    room_type = data.get('room_type', 'Standard') # Standard, Deluxe, Suite
    check_in = data.get('check_in_date')
    check_out = data.get('check_out_date')
    
    if not hotel_id or not check_in or not check_out:
        return jsonify({'error': 'Missing required booking fields.'}), 400
        
    hotel = Hotel.query.get_or_404(hotel_id)
    if hotel.available_rooms <= 0:
        return jsonify({'error': 'No rooms available at this hotel.'}), 400
        
    # Calculate price multiplier based on room type
    base_cost = hotel.average_cost / 2.0 if hotel.average_cost else 300.0
    multiplier = 1.0 if room_type == 'Standard' else 1.6 if room_type == 'Deluxe' else 2.5
    
    # Calculate days
    try:
        d1 = datetime.strptime(check_in, '%Y-%m-%d')
        d2 = datetime.strptime(check_out, '%Y-%m-%d')
        days = max((d2 - d1).days, 1)
    except:
        days = 1
        
    total_price = round(base_cost * multiplier * days, 2)
    
    new_booking = Booking(
        user_id=user_id,
        hotel_id=hotel_id,
        room_type=room_type,
        check_in_date=check_in,
        check_out_date=check_out,
        total_price=total_price,
        status='pending'
    )
    
    # Reduce room availability
    hotel.available_rooms -= 1
    
    db.session.add(new_booking)
    db.session.commit()
    
    return jsonify({
        'message': 'Booking request submitted successfully!',
        'booking_id': new_booking.id,
        'total_price': total_price
    }), 201

@app.route('/api/bookings/history', methods=['GET'])
def get_booking_history():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized.'}), 401
        
    bookings = Booking.query.filter_by(user_id=user_id).order_by(Booking.created_at.desc()).all()
    bookings_list = [{
        'id': b.id,
        'hotel_name': b.hotel.name,
        'hotel_city': b.hotel.city,
        'hotel_image': b.hotel.image_url,
        'room_type': b.room_type,
        'check_in_date': b.check_in_date,
        'check_out_date': b.check_out_date,
        'total_price': b.total_price,
        'status': b.status,
        'created_at': b.created_at.strftime('%Y-%m-%d')
    } for b in bookings]
    
    return jsonify(bookings_list)

@app.route('/api/bookings/<int:booking_id>/cancel', methods=['POST'])
def cancel_booking_endpoint(booking_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized.'}), 401
        
    booking = Booking.query.get_or_404(booking_id)
    if booking.user_id != user_id and session.get('role') != 'admin':
        return jsonify({'error': 'Permission denied.'}), 403
        
    if booking.status in ['cancelled', 'rejected']:
        return jsonify({'error': f'Booking already {booking.status}.'}), 400
        
    # Free up the room slot
    booking.hotel.available_rooms += 1
    booking.status = 'cancelled'
    db.session.commit()
    
    return jsonify({'message': 'Booking cancelled successfully.'}), 200

# 6. Admin Listings CRUD & Booking Management
@app.route('/api/admin/bookings', methods=['GET'])
def admin_get_bookings():
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized. Admin access required.'}), 403
        
    bookings = Booking.query.order_by(Booking.created_at.desc()).all()
    bookings_list = [{
        'id': b.id,
        'username': b.user.username,
        'hotel_name': b.hotel.name,
        'hotel_city': b.hotel.city,
        'room_type': b.room_type,
        'check_in_date': b.check_in_date,
        'check_out_date': b.check_out_date,
        'total_price': b.total_price,
        'status': b.status,
        'created_at': b.created_at.strftime('%Y-%m-%d %H:%M')
    } for b in bookings]
    
    return jsonify(bookings_list)

@app.route('/api/admin/bookings/<int:booking_id>/approve', methods=['POST'])
def approve_booking(booking_id):
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized.'}), 403
        
    booking = Booking.query.get_or_404(booking_id)
    booking.status = 'approved'
    db.session.commit()
    return jsonify({'message': 'Booking approved successfully.'}), 200

@app.route('/api/admin/bookings/<int:booking_id>/reject', methods=['POST'])
def reject_booking(booking_id):
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized.'}), 403
        
    booking = Booking.query.get_or_404(booking_id)
    booking.status = 'rejected'
    
    # Restore the room slot
    booking.hotel.available_rooms += 1
    db.session.commit()
    return jsonify({'message': 'Booking rejected successfully.'}), 200

@app.route('/api/admin/hotels', methods=['POST'])
def admin_add_hotel():
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized.'}), 403
        
    data = request.json
    name = data.get('name')
    city = data.get('city')
    address = data.get('address')
    locality = data.get('locality')
    cuisines = data.get('cuisines', 'General')
    average_cost = float(data.get('average_cost', 500))
    currency = data.get('currency', 'Indian Rupees(Rs.)')
    price_range = int(data.get('price_range', 2))
    latitude = float(data.get('latitude', 28.6))
    longitude = float(data.get('longitude', 77.2))
    aggregate_rating = float(data.get('aggregate_rating', 0.0))
    rating_color = data.get('rating_color', 'Orange')
    rating_text = data.get('rating_text', 'Average')
    votes = int(data.get('votes', 0))
    available_rooms = int(data.get('available_rooms', 5))
    
    if not name or not city:
        return jsonify({'error': 'Hotel Name and City are required.'}), 400
        
    img_url = HOTEL_IMAGES[Hotel.query.count() % len(HOTEL_IMAGES)]
    
    new_hotel = Hotel(
        name=name,
        city=city,
        address=address,
        locality=locality,
        cuisines=cuisines,
        average_cost=average_cost,
        currency=currency,
        price_range=price_range,
        latitude=latitude,
        longitude=longitude,
        aggregate_rating=aggregate_rating,
        rating_color=rating_color,
        rating_text=rating_text,
        votes=votes,
        available_rooms=available_rooms,
        image_url=img_url,
        is_deleted=False
    )
    
    db.session.add(new_hotel)
    db.session.commit()
    
    return jsonify({'message': 'Hotel created successfully!', 'hotel_id': new_hotel.id}), 201

@app.route('/api/admin/hotels/<int:hotel_id>', methods=['PUT', 'DELETE'])
def admin_manage_hotel(hotel_id):
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized.'}), 403
        
    hotel = Hotel.query.get_or_404(hotel_id)
    
    if request.method == 'DELETE':
        hotel.is_deleted = True
        db.session.commit()
        return jsonify({'message': 'Hotel deleted successfully.'}), 200
        
    elif request.method == 'PUT':
        data = request.json
        hotel.name = data.get('name', hotel.name)
        hotel.city = data.get('city', hotel.city)
        hotel.address = data.get('address', hotel.address)
        hotel.locality = data.get('locality', hotel.locality)
        hotel.cuisines = data.get('cuisines', hotel.cuisines)
        hotel.average_cost = float(data.get('average_cost', hotel.average_cost))
        hotel.currency = data.get('currency', hotel.currency)
        hotel.price_range = int(data.get('price_range', hotel.price_range))
        hotel.latitude = float(data.get('latitude', hotel.latitude))
        hotel.longitude = float(data.get('longitude', hotel.longitude))
        hotel.aggregate_rating = float(data.get('aggregate_rating', hotel.aggregate_rating))
        hotel.rating_color = data.get('rating_color', hotel.rating_color)
        hotel.rating_text = data.get('rating_text', hotel.rating_text)
        hotel.votes = int(data.get('votes', hotel.votes))
        hotel.available_rooms = int(data.get('available_rooms', hotel.available_rooms))
        
        db.session.commit()
        return jsonify({'message': 'Hotel details updated successfully.'}), 200

# 7. Admin Analytics
@app.route('/api/admin/analytics', methods=['GET'])
def get_admin_analytics():
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized.'}), 403
        
    # a. Total counts
    total_users = User.query.filter_by(role='user').count()
    total_bookings = Booking.query.count()
    total_hotels = Hotel.query.filter_by(is_deleted=False).count()
    
    # b. Booking statuses
    pending_bookings = Booking.query.filter_by(status='pending').count()
    approved_bookings = Booking.query.filter_by(status='approved').count()
    rejected_bookings = Booking.query.filter_by(status='rejected').count()
    cancelled_bookings = Booking.query.filter_by(status='cancelled').count()
    
    # c. Most Booked Hotels
    most_booked = db.session.query(Hotel.name, db.func.count(Booking.id).label('booking_count'))\
                            .join(Booking, Booking.hotel_id == Hotel.id)\
                            .group_by(Hotel.name)\
                            .order_by(db.desc('booking_count'))\
                            .limit(6).all()
                            
    most_booked_labels = [h[0] for h in most_booked]
    most_booked_values = [h[1] for h in most_booked]

    # d. Top Rated Hotels
    top_rated = Hotel.query.filter(Hotel.is_deleted == False)\
                           .order_by(Hotel.aggregate_rating.desc(), Hotel.votes.desc())\
                           .limit(6).all()
                           
    top_rated_labels = [h.name for h in top_rated]
    top_rated_values = [h.aggregate_rating for h in top_rated]

    # e. Ratings Distribution
    rating_bins = {
        'Excellent (4.5+)': Hotel.query.filter(Hotel.is_deleted == False, Hotel.aggregate_rating >= 4.5).count(),
        'Very Good (4.0-4.4)': Hotel.query.filter(Hotel.is_deleted == False, Hotel.aggregate_rating >= 4.0, Hotel.aggregate_rating < 4.5).count(),
        'Good (3.5-3.9)': Hotel.query.filter(Hotel.is_deleted == False, Hotel.aggregate_rating >= 3.5, Hotel.aggregate_rating < 4.0).count(),
        'Average (2.5-3.4)': Hotel.query.filter(Hotel.is_deleted == False, Hotel.aggregate_rating >= 2.5, Hotel.aggregate_rating < 3.5).count(),
        'Poor (<2.5)': Hotel.query.filter(Hotel.is_deleted == False, Hotel.aggregate_rating > 0, Hotel.aggregate_rating < 2.5).count(),
        'Not rated': Hotel.query.filter(Hotel.is_deleted == False, Hotel.aggregate_rating == 0).count()
    }

    # f. Recommendation performance metric
    # Show active user personalization coverage rate
    users_with_bookings = db.session.query(db.func.count(db.distinct(Booking.user_id))).filter(Booking.status == 'approved').scalar() or 0
    total_active_users = db.session.query(db.func.count(User.id)).filter(User.role == 'user').scalar() or 0
    rec_coverage_pct = round((users_with_bookings / total_active_users * 100), 1) if total_active_users > 0 else 0.0

    return jsonify({
        'summary': {
            'total_users': total_users,
            'total_bookings': total_bookings,
            'total_hotels': total_hotels,
            'rec_coverage_pct': rec_coverage_pct
        },
        'booking_status': {
            'pending': pending_bookings,
            'approved': approved_bookings,
            'rejected': rejected_bookings,
            'cancelled': cancelled_bookings
        },
        'most_booked': {
            'labels': most_booked_labels,
            'values': most_booked_values
        },
        'top_rated': {
            'labels': top_rated_labels,
            'values': top_rated_values
        },
        'rating_distribution': {
            'labels': list(rating_bins.keys()),
            'values': list(rating_bins.values())
        }
    })

# Serve static index.html at root
@app.route('/')
def index():
    return app.send_static_file('index.html')

# Main serve routine
if __name__ == '__main__':
    if load_ml_models_and_data():
        with app.app_context():
            seed_database_if_empty()
        print("Server starting on http://localhost:5000...")
        app.run(host='0.0.0.0', port=5000, debug=True)
    else:
        print("Failed to initialize models. Exiting...")
