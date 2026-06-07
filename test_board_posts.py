#!/usr/bin/env python3
"""
Board Posts API Testing for GenC Vibez
Tests all board post endpoints including create, get, like, comment functionality
"""

import requests
import json
import time
from typing import Dict, Optional

# Backend URL
BASE_URL = "https://player-arena-social.preview.emergentagent.com/api"

# Test credentials
TEST_USER_1 = {
    "email": "boarduser1@test.com",
    "password": "password123",
    "username": "boarduser1",
    "displayName": "Board User One"
}

TEST_USER_2 = {
    "email": "boarduser2@test.com",
    "password": "password123",
    "username": "boarduser2",
    "displayName": "Board User Two"
}

# Global variables to store test data
auth_token_1 = None
auth_token_2 = None
user_id_1 = None
user_id_2 = None
room_id = None
post_id = None
comment_id = None

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(test_name: str):
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}Testing: {test_name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")

def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")

def print_info(message: str):
    print(f"  {message}")

def make_request(method: str, endpoint: str, data: Optional[Dict] = None, 
                 headers: Optional[Dict] = None, expect_error: bool = False) -> tuple:
    """Make HTTP request and return (success, response_data, status_code)"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=10)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            return False, {"error": "Invalid method"}, 0
        
        # Check if request was successful
        if expect_error:
            success = response.status_code >= 400
        else:
            success = 200 <= response.status_code < 300
        
        try:
            response_data = response.json()
        except:
            response_data = {"text": response.text}
        
        return success, response_data, response.status_code
    
    except requests.exceptions.RequestException as e:
        return False, {"error": str(e)}, 0

def get_auth_headers(token: str) -> Dict:
    """Get authorization headers with token"""
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}

# ==================== AUTH TESTS ====================

def test_register_user1():
    """Test user 1 registration"""
    global auth_token_1, user_id_1
    print_test("User 1 Registration")
    
    success, data, status = make_request("POST", "/auth/register", TEST_USER_1)
    
    if success and "access_token" in data:
        auth_token_1 = data["access_token"]
        print_success(f"User 1 registered successfully")
        print_info(f"Token: {auth_token_1[:20]}...")
        
        # Get user profile to get user_id
        success2, profile, _ = make_request("GET", "/auth/me", headers=get_auth_headers(auth_token_1))
        if success2:
            user_id_1 = profile.get("id")
            print_info(f"User ID: {user_id_1}")
        return True
    elif status == 400 and "already exists" in str(data):
        # User already exists, try login
        print_warning("User 1 already exists, attempting login...")
        return test_login_user1()
    else:
        print_error(f"Registration failed: {data}")
        return False

def test_login_user1():
    """Test user 1 login"""
    global auth_token_1, user_id_1
    print_test("User 1 Login")
    
    login_data = {
        "identifier": TEST_USER_1["email"],
        "password": TEST_USER_1["password"]
    }
    
    success, data, status = make_request("POST", "/auth/login", login_data)
    
    if success and "access_token" in data:
        auth_token_1 = data["access_token"]
        print_success(f"User 1 logged in successfully")
        
        # Get user profile
        success2, profile, _ = make_request("GET", "/auth/me", headers=get_auth_headers(auth_token_1))
        if success2:
            user_id_1 = profile.get("id")
            print_info(f"User ID: {user_id_1}")
        return True
    else:
        print_error(f"Login failed: {data}")
        return False

def test_register_user2():
    """Test user 2 registration"""
    global auth_token_2, user_id_2
    print_test("User 2 Registration")
    
    success, data, status = make_request("POST", "/auth/register", TEST_USER_2)
    
    if success and "access_token" in data:
        auth_token_2 = data["access_token"]
        print_success(f"User 2 registered successfully")
        
        # Get user profile
        success2, profile, _ = make_request("GET", "/auth/me", headers=get_auth_headers(auth_token_2))
        if success2:
            user_id_2 = profile.get("id")
            print_info(f"User ID: {user_id_2}")
        return True
    elif status == 400 and "already exists" in str(data):
        # User already exists, try login
        print_warning("User 2 already exists, attempting login...")
        return test_login_user2()
    else:
        print_error(f"Registration failed: {data}")
        return False

def test_login_user2():
    """Test user 2 login"""
    global auth_token_2, user_id_2
    print_test("User 2 Login")
    
    login_data = {
        "identifier": TEST_USER_2["email"],
        "password": TEST_USER_2["password"]
    }
    
    success, data, status = make_request("POST", "/auth/login", login_data)
    
    if success and "access_token" in data:
        auth_token_2 = data["access_token"]
        print_success(f"User 2 logged in successfully")
        
        # Get user profile
        success2, profile, _ = make_request("GET", "/auth/me", headers=get_auth_headers(auth_token_2))
        if success2:
            user_id_2 = profile.get("id")
            print_info(f"User ID: {user_id_2}")
        return True
    else:
        print_error(f"Login failed: {data}")
        return False

# ==================== ROOM SETUP ====================

def test_init_rooms():
    """Initialize default rooms"""
    print_test("Initialize Rooms")
    
    success, data, status = make_request("POST", "/init/rooms", headers=get_auth_headers(auth_token_1))
    
    if success:
        print_success("Rooms initialized successfully")
        return True
    else:
        print_warning(f"Room initialization response: {data}")
        return True  # May already be initialized

def test_get_rooms():
    """Get list of rooms"""
    global room_id
    print_test("Get Rooms List")
    
    success, data, status = make_request("GET", "/rooms", headers=get_auth_headers(auth_token_1))
    
    if success and isinstance(data, list) and len(data) > 0:
        room_id = data[0]["id"]
        print_success(f"Retrieved {len(data)} rooms")
        print_info(f"Using room: {data[0]['roomName']} (ID: {room_id})")
        return True
    else:
        print_error(f"Failed to get rooms: {data}")
        return False

def test_join_room():
    """Join a room"""
    print_test("Join Room (User 1)")
    
    success, data, status = make_request("POST", f"/rooms/{room_id}/join", headers=get_auth_headers(auth_token_1))
    
    if success:
        print_success(f"User 1 joined room successfully")
        return True
    else:
        print_error(f"Failed to join room: {data}")
        return False

def test_join_room_user2():
    """Join a room as user 2"""
    print_test("Join Room (User 2)")
    
    success, data, status = make_request("POST", f"/rooms/{room_id}/join", headers=get_auth_headers(auth_token_2))
    
    if success:
        print_success(f"User 2 joined room successfully")
        return True
    else:
        print_error(f"Failed to join room: {data}")
        return False

# ==================== BOARD POSTS TESTS ====================

def test_create_post():
    """Test creating a post in a room"""
    global post_id
    print_test("Create Board Post")
    
    post_data = {
        "text": "This is my first board post! 🎉 Testing the new board feature.",
        "imageBase64": None
    }
    
    success, data, status = make_request("POST", f"/rooms/{room_id}/posts", 
                                        data=post_data, 
                                        headers=get_auth_headers(auth_token_1))
    
    if success and "id" in data:
        post_id = data["id"]
        print_success(f"Post created successfully")
        print_info(f"Post ID: {post_id}")
        print_info(f"Author: {data.get('authorDisplayName')}")
        print_info(f"Text: {data.get('text')[:50]}...")
        print_info(f"Likes: {data.get('likesCount')}, Comments: {data.get('commentsCount')}")
        print_info(f"Liked by me: {data.get('likedByMe')}")
        
        # Validate response structure
        required_fields = ["id", "roomId", "authorId", "authorUsername", "authorDisplayName", 
                          "text", "likesCount", "commentsCount", "likedByMe", "createdAt"]
        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            print_error(f"Missing fields in response: {missing_fields}")
            return False
        
        return True
    else:
        print_error(f"Failed to create post: {data}")
        return False

def test_create_post_with_image():
    """Test creating a post with base64 image"""
    print_test("Create Board Post with Image")
    
    # Small test image (1x1 pixel PNG in base64)
    small_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    post_data = {
        "text": "Check out this image! 📸",
        "imageBase64": small_image
    }
    
    success, data, status = make_request("POST", f"/rooms/{room_id}/posts", 
                                        data=post_data, 
                                        headers=get_auth_headers(auth_token_1))
    
    if success and "id" in data:
        print_success(f"Post with image created successfully")
        print_info(f"Post ID: {data['id']}")
        print_info(f"Has image: {data.get('imageBase64') is not None}")
        return True
    else:
        print_error(f"Failed to create post with image: {data}")
        return False

def test_get_room_posts():
    """Test getting posts for a room"""
    print_test("Get Room Posts")
    
    success, data, status = make_request("GET", f"/rooms/{room_id}/posts", 
                                        headers=get_auth_headers(auth_token_1))
    
    if success and isinstance(data, list):
        print_success(f"Retrieved {len(data)} posts")
        if len(data) > 0:
            print_info(f"First post: {data[0].get('text', '')[:50]}...")
            print_info(f"Post author: {data[0].get('authorDisplayName')}")
        return True
    else:
        print_error(f"Failed to get posts: {data}")
        return False

def test_get_single_post():
    """Test getting a single post by ID"""
    print_test("Get Single Post")
    
    success, data, status = make_request("GET", f"/posts/{post_id}", 
                                        headers=get_auth_headers(auth_token_1))
    
    if success and "id" in data:
        print_success(f"Retrieved post successfully")
        print_info(f"Post ID: {data['id']}")
        print_info(f"Text: {data.get('text', '')[:50]}...")
        return True
    else:
        print_error(f"Failed to get post: {data}")
        return False

def test_like_post():
    """Test liking a post"""
    print_test("Like Post")
    
    success, data, status = make_request("POST", f"/posts/{post_id}/like", 
                                        headers=get_auth_headers(auth_token_2))
    
    if success and "liked" in data:
        print_success(f"Post like toggled successfully")
        print_info(f"Liked: {data['liked']}")
        print_info(f"Total likes: {data['likesCount']}")
        
        if data['liked'] and data['likesCount'] >= 1:
            print_success("Like count increased correctly")
            return True
        else:
            print_error(f"Like state inconsistent: liked={data['liked']}, count={data['likesCount']}")
            return False
    else:
        print_error(f"Failed to like post: {data}")
        return False

def test_unlike_post():
    """Test unliking a post"""
    print_test("Unlike Post")
    
    success, data, status = make_request("POST", f"/posts/{post_id}/like", 
                                        headers=get_auth_headers(auth_token_2))
    
    if success and "liked" in data:
        print_success(f"Post unlike toggled successfully")
        print_info(f"Liked: {data['liked']}")
        print_info(f"Total likes: {data['likesCount']}")
        
        if not data['liked']:
            print_success("Unlike successful")
            return True
        else:
            print_error(f"Unlike failed: still liked")
            return False
    else:
        print_error(f"Failed to unlike post: {data}")
        return False

def test_verify_liked_by_me():
    """Test that likedByMe field is correct for different users"""
    print_test("Verify 'likedByMe' Field")
    
    # User 1 likes the post
    success1, data1, _ = make_request("POST", f"/posts/{post_id}/like", 
                                     headers=get_auth_headers(auth_token_1))
    
    if not success1:
        print_error("Failed to like post as user 1")
        return False
    
    # User 1 gets the post - should see likedByMe=true
    success2, data2, _ = make_request("GET", f"/posts/{post_id}", 
                                     headers=get_auth_headers(auth_token_1))
    
    if success2 and data2.get("likedByMe") == True:
        print_success("User 1 sees likedByMe=true (correct)")
    else:
        print_error(f"User 1 should see likedByMe=true but got: {data2.get('likedByMe')}")
        return False
    
    # User 2 gets the post - should see likedByMe=false
    success3, data3, _ = make_request("GET", f"/posts/{post_id}", 
                                     headers=get_auth_headers(auth_token_2))
    
    if success3 and data3.get("likedByMe") == False:
        print_success("User 2 sees likedByMe=false (correct)")
        return True
    else:
        print_error(f"User 2 should see likedByMe=false but got: {data3.get('likedByMe')}")
        return False

def test_add_comment():
    """Test adding a comment to a post"""
    global comment_id
    print_test("Add Comment to Post")
    
    comment_data = {
        "text": "Great post! I totally agree with this. 👍"
    }
    
    success, data, status = make_request("POST", f"/posts/{post_id}/comments", 
                                        data=comment_data, 
                                        headers=get_auth_headers(auth_token_2))
    
    if success and "id" in data:
        comment_id = data["id"]
        print_success(f"Comment added successfully")
        print_info(f"Comment ID: {comment_id}")
        print_info(f"Author: {data.get('authorDisplayName')}")
        print_info(f"Text: {data.get('text')}")
        
        # Validate response structure
        required_fields = ["id", "postId", "authorId", "authorUsername", 
                          "authorDisplayName", "text", "createdAt"]
        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            print_error(f"Missing fields in response: {missing_fields}")
            return False
        
        return True
    else:
        print_error(f"Failed to add comment: {data}")
        return False

def test_get_comments():
    """Test getting comments for a post"""
    print_test("Get Post Comments")
    
    success, data, status = make_request("GET", f"/posts/{post_id}/comments", 
                                        headers=get_auth_headers(auth_token_1))
    
    if success and isinstance(data, list):
        print_success(f"Retrieved {len(data)} comments")
        if len(data) > 0:
            print_info(f"First comment: {data[0].get('text', '')[:50]}...")
            print_info(f"Comment author: {data[0].get('authorDisplayName')}")
        
        # Verify comment count
        if len(data) >= 1:
            print_success("Comment count is correct")
            return True
        else:
            print_error("Expected at least 1 comment")
            return False
    else:
        print_error(f"Failed to get comments: {data}")
        return False

def test_verify_comment_count():
    """Test that commentsCount is updated correctly"""
    print_test("Verify Comment Count on Post")
    
    success, data, status = make_request("GET", f"/posts/{post_id}", 
                                        headers=get_auth_headers(auth_token_1))
    
    if success and "commentsCount" in data:
        comments_count = data["commentsCount"]
        print_info(f"Post commentsCount: {comments_count}")
        
        if comments_count >= 1:
            print_success(f"Comment count updated correctly ({comments_count})")
            return True
        else:
            print_error(f"Expected commentsCount >= 1, got {comments_count}")
            return False
    else:
        print_error(f"Failed to get post: {data}")
        return False

def test_add_multiple_comments():
    """Test adding multiple comments"""
    print_test("Add Multiple Comments")
    
    comments = [
        "This is comment number 2",
        "And here's comment number 3!",
        "Final comment for testing"
    ]
    
    success_count = 0
    for i, comment_text in enumerate(comments, start=2):
        comment_data = {"text": comment_text}
        success, data, _ = make_request("POST", f"/posts/{post_id}/comments", 
                                       data=comment_data, 
                                       headers=get_auth_headers(auth_token_1))
        if success:
            success_count += 1
            print_info(f"Comment {i} added")
    
    if success_count == len(comments):
        print_success(f"All {len(comments)} comments added successfully")
        return True
    else:
        print_error(f"Only {success_count}/{len(comments)} comments added")
        return False

# ==================== ERROR HANDLING TESTS ====================

def test_create_post_empty_text():
    """Test creating post with empty text (should fail)"""
    print_test("Create Post with Empty Text (Error Case)")
    
    post_data = {
        "text": "   ",  # Only whitespace
        "imageBase64": None
    }
    
    success, data, status = make_request("POST", f"/rooms/{room_id}/posts", 
                                        data=post_data, 
                                        headers=get_auth_headers(auth_token_1),
                                        expect_error=True)
    
    if success and status == 400:
        print_success(f"Correctly rejected empty post: {data.get('detail')}")
        return True
    else:
        print_error(f"Should have rejected empty post but got status {status}")
        return False

def test_create_post_too_long():
    """Test creating post with text exceeding limit (should fail)"""
    print_test("Create Post with Text Too Long (Error Case)")
    
    post_data = {
        "text": "x" * 2001,  # Exceeds 2000 character limit
        "imageBase64": None
    }
    
    success, data, status = make_request("POST", f"/rooms/{room_id}/posts", 
                                        data=post_data, 
                                        headers=get_auth_headers(auth_token_1),
                                        expect_error=True)
    
    if success and status == 400:
        print_success(f"Correctly rejected long post: {data.get('detail')}")
        return True
    else:
        print_error(f"Should have rejected long post but got status {status}")
        return False

def test_add_comment_empty_text():
    """Test adding comment with empty text (should fail)"""
    print_test("Add Comment with Empty Text (Error Case)")
    
    comment_data = {
        "text": ""
    }
    
    success, data, status = make_request("POST", f"/posts/{post_id}/comments", 
                                        data=comment_data, 
                                        headers=get_auth_headers(auth_token_1),
                                        expect_error=True)
    
    if success and status == 400:
        print_success(f"Correctly rejected empty comment: {data.get('detail')}")
        return True
    else:
        print_error(f"Should have rejected empty comment but got status {status}")
        return False

def test_add_comment_too_long():
    """Test adding comment exceeding limit (should fail)"""
    print_test("Add Comment Too Long (Error Case)")
    
    comment_data = {
        "text": "x" * 501  # Exceeds 500 character limit
    }
    
    success, data, status = make_request("POST", f"/posts/{post_id}/comments", 
                                        data=comment_data, 
                                        headers=get_auth_headers(auth_token_1),
                                        expect_error=True)
    
    if success and status == 400:
        print_success(f"Correctly rejected long comment: {data.get('detail')}")
        return True
    else:
        print_error(f"Should have rejected long comment but got status {status}")
        return False

def test_like_invalid_post():
    """Test liking a non-existent post (should fail)"""
    print_test("Like Invalid Post (Error Case)")
    
    invalid_post_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but doesn't exist
    
    success, data, status = make_request("POST", f"/posts/{invalid_post_id}/like", 
                                        headers=get_auth_headers(auth_token_1),
                                        expect_error=True)
    
    if success and status == 404:
        print_success(f"Correctly returned 404 for invalid post: {data.get('detail')}")
        return True
    else:
        print_error(f"Should have returned 404 but got status {status}")
        return False

def test_get_comments_invalid_post():
    """Test getting comments for non-existent post (should fail)"""
    print_test("Get Comments for Invalid Post (Error Case)")
    
    invalid_post_id = "507f1f77bcf86cd799439011"
    
    success, data, status = make_request("GET", f"/posts/{invalid_post_id}/comments", 
                                        headers=get_auth_headers(auth_token_1),
                                        expect_error=True)
    
    if success and status == 404:
        print_success(f"Correctly returned 404 for invalid post: {data.get('detail')}")
        return True
    else:
        print_error(f"Should have returned 404 but got status {status}")
        return False

def test_create_post_invalid_room():
    """Test creating post in non-existent room (should fail)"""
    print_test("Create Post in Invalid Room (Error Case)")
    
    invalid_room_id = "507f1f77bcf86cd799439011"
    post_data = {
        "text": "This should fail",
        "imageBase64": None
    }
    
    success, data, status = make_request("POST", f"/rooms/{invalid_room_id}/posts", 
                                        data=post_data, 
                                        headers=get_auth_headers(auth_token_1),
                                        expect_error=True)
    
    if success and status == 404:
        print_success(f"Correctly returned 404 for invalid room: {data.get('detail')}")
        return True
    else:
        print_error(f"Should have returned 404 but got status {status}")
        return False

def test_unauthorized_access():
    """Test accessing endpoints without auth token (should fail)"""
    print_test("Unauthorized Access (Error Case)")
    
    success, data, status = make_request("GET", f"/rooms/{room_id}/posts", 
                                        expect_error=True)
    
    if success and status == 403:
        print_success(f"Correctly rejected unauthorized access")
        return True
    else:
        print_error(f"Should have returned 403 but got status {status}")
        return False

# ==================== MAIN TEST RUNNER ====================

def run_all_tests():
    """Run all board posts tests"""
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}BOARD POSTS API TEST SUITE{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    
    tests = [
        # Setup
        ("User 1 Registration/Login", test_register_user1),
        ("User 2 Registration/Login", test_register_user2),
        ("Initialize Rooms", test_init_rooms),
        ("Get Rooms", test_get_rooms),
        ("Join Room (User 1)", test_join_room),
        ("Join Room (User 2)", test_join_room_user2),
        
        # Core functionality
        ("Create Post", test_create_post),
        ("Create Post with Image", test_create_post_with_image),
        ("Get Room Posts", test_get_room_posts),
        ("Get Single Post", test_get_single_post),
        ("Like Post", test_like_post),
        ("Unlike Post", test_unlike_post),
        ("Verify likedByMe Field", test_verify_liked_by_me),
        ("Add Comment", test_add_comment),
        ("Get Comments", test_get_comments),
        ("Verify Comment Count", test_verify_comment_count),
        ("Add Multiple Comments", test_add_multiple_comments),
        
        # Error handling
        ("Empty Post Text Error", test_create_post_empty_text),
        ("Post Text Too Long Error", test_create_post_too_long),
        ("Empty Comment Text Error", test_add_comment_empty_text),
        ("Comment Too Long Error", test_add_comment_too_long),
        ("Like Invalid Post Error", test_like_invalid_post),
        ("Get Comments Invalid Post Error", test_get_comments_invalid_post),
        ("Create Post Invalid Room Error", test_create_post_invalid_room),
        ("Unauthorized Access Error", test_unauthorized_access),
    ]
    
    results = []
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
            if result:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print_error(f"Test crashed: {str(e)}")
            results.append((test_name, False))
            failed += 1
        
        time.sleep(0.5)  # Small delay between tests
    
    # Print summary
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    
    for test_name, result in results:
        status = f"{Colors.GREEN}✓ PASS{Colors.END}" if result else f"{Colors.RED}✗ FAIL{Colors.END}"
        print(f"{status} - {test_name}")
    
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    total = passed + failed
    pass_rate = (passed / total * 100) if total > 0 else 0
    
    if failed == 0:
        print(f"{Colors.GREEN}ALL TESTS PASSED! ✓{Colors.END}")
    else:
        print(f"{Colors.YELLOW}SOME TESTS FAILED{Colors.END}")
    
    print(f"Total: {total} | Passed: {Colors.GREEN}{passed}{Colors.END} | Failed: {Colors.RED}{failed}{Colors.END} | Pass Rate: {pass_rate:.1f}%")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}\n")
    
    return passed, failed

if __name__ == "__main__":
    passed, failed = run_all_tests()
    exit(0 if failed == 0 else 1)
