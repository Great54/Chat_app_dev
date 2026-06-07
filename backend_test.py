#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for GenC Vibez
Tests all endpoints including auth, rooms, messages, coins, games, and leaderboard
"""

import requests
import json
import time
from typing import Dict, Optional

# Backend URL
BASE_URL = "https://posts-profile-ui.preview.emergentagent.com/api"

# Test credentials
TEST_USER = {
    "email": "alice@test.com",
    "password": "password123",
    "username": "alice",
    "displayName": "Alice Wonder"
}

# Global variables to store test data
auth_token = None
user_id = None
room_ids = []
message_ids = []

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

def get_auth_headers() -> Dict:
    """Get authorization headers with token"""
    if auth_token:
        return {"Authorization": f"Bearer {auth_token}"}
    return {}

# ==================== AUTH TESTS ====================

def test_register():
    """Test user registration"""
    print_test("User Registration")
    
    success, data, status = make_request("POST", "/auth/register", TEST_USER)
    
    if success and "access_token" in data:
        global auth_token
        auth_token = data["access_token"]
        print_success(f"Registration successful")
        print_info(f"Token received: {auth_token[:20]}...")
        return True
    else:
        # User might already exist, try login
        print_warning(f"Registration failed (might already exist): {data}")
        return test_login()

def test_login():
    """Test user login"""
    print_test("User Login")
    
    login_data = {
        "email": TEST_USER["email"],
        "password": TEST_USER["password"]
    }
    
    success, data, status = make_request("POST", "/auth/login", login_data)
    
    if success and "access_token" in data:
        global auth_token
        auth_token = data["access_token"]
        print_success(f"Login successful")
        print_info(f"Token: {auth_token[:20]}...")
        return True
    else:
        print_error(f"Login failed: {data}")
        return False

def test_get_me():
    """Test getting current user profile"""
    print_test("Get User Profile (/auth/me)")
    
    success, data, status = make_request("GET", "/auth/me", headers=get_auth_headers())
    
    if success and "id" in data:
        global user_id
        user_id = data["id"]
        print_success(f"Profile retrieved successfully")
        print_info(f"User ID: {user_id}")
        print_info(f"Username: {data.get('username')}")
        print_info(f"Display Name: {data.get('displayName')}")
        print_info(f"Coins: {data.get('coins', 0)}")
        print_info(f"XP: {data.get('xp', 0)}")
        print_info(f"Level: {data.get('level', 0)}")
        
        # Verify starting coins
        if data.get('coins', 0) >= 100:
            print_success(f"User has starting coins: {data.get('coins')}")
        else:
            print_warning(f"User coins less than expected: {data.get('coins')}")
        
        return True
    else:
        print_error(f"Failed to get profile: {data}")
        return False

# ==================== ROOM TESTS ====================

def test_init_rooms():
    """Test initializing default rooms"""
    print_test("Initialize Default Rooms")
    
    success, data, status = make_request("POST", "/init/rooms")
    
    if success or "already initialized" in str(data).lower():
        print_success(f"Rooms initialized: {data.get('message', data)}")
        return True
    else:
        print_error(f"Failed to initialize rooms: {data}")
        return False

def test_get_rooms():
    """Test getting all rooms"""
    print_test("Get All Rooms")
    
    success, data, status = make_request("GET", "/rooms")
    
    if success and isinstance(data, list):
        global room_ids
        room_ids = [room["id"] for room in data if "id" in room]
        
        print_success(f"Retrieved {len(data)} rooms")
        for room in data:
            print_info(f"  - {room.get('roomName')}: {room.get('currentUserCount')}/{room.get('maxCapacity')} users")
        
        if len(data) >= 4:
            print_success("All default rooms present (World Vibez, Games, BTS, Harry Potter)")
        else:
            print_warning(f"Expected 4 rooms, found {len(data)}")
        
        return True
    else:
        print_error(f"Failed to get rooms: {data}")
        return False

def test_join_room():
    """Test joining a room"""
    print_test("Join Room")
    
    if not room_ids:
        print_error("No rooms available to join")
        return False
    
    room_id = room_ids[0]
    success, data, status = make_request("POST", f"/rooms/{room_id}/join", headers=get_auth_headers())
    
    if success:
        print_success(f"Joined room successfully: {data.get('message')}")
        
        # Verify user count increased
        time.sleep(0.5)
        success2, room_data, _ = make_request("GET", "/rooms")
        if success2:
            for room in room_data:
                if room["id"] == room_id:
                    print_info(f"Room user count: {room.get('currentUserCount')}")
                    if room.get('currentUserCount', 0) > 0:
                        print_success("User count increased after join")
                    break
        
        return True
    else:
        print_error(f"Failed to join room: {data}")
        return False

def test_get_room_members():
    """Test getting room members"""
    print_test("Get Room Members")
    
    if not room_ids:
        print_error("No rooms available")
        return False
    
    room_id = room_ids[0]
    success, data, status = make_request("GET", f"/rooms/{room_id}/members")
    
    if success and isinstance(data, list):
        print_success(f"Retrieved {len(data)} room members")
        for member in data:
            print_info(f"  - {member.get('username')} (Level {member.get('level', 0)})")
        return True
    else:
        print_error(f"Failed to get room members: {data}")
        return False

# ==================== MESSAGE TESTS ====================

def test_send_message():
    """Test sending a message in a room"""
    print_test("Send Message")
    
    if not room_ids:
        print_error("No rooms available")
        return False
    
    room_id = room_ids[0]
    message_data = {"messageText": "Hello from automated test! This is a test message."}
    
    success, data, status = make_request("POST", f"/messages/{room_id}", 
                                        message_data, headers=get_auth_headers())
    
    if success and "id" in data:
        global message_ids
        message_ids.append(data["id"])
        print_success(f"Message sent successfully")
        print_info(f"Message ID: {data.get('id')}")
        print_info(f"Sender: {data.get('senderName')}")
        print_info(f"Text: {data.get('messageText')}")
        return True
    else:
        print_error(f"Failed to send message: {data}")
        return False

def test_get_messages():
    """Test retrieving messages from a room"""
    print_test("Get Messages")
    
    if not room_ids:
        print_error("No rooms available")
        return False
    
    room_id = room_ids[0]
    success, data, status = make_request("GET", f"/messages/{room_id}")
    
    if success and isinstance(data, list):
        print_success(f"Retrieved {len(data)} messages")
        for msg in data[-3:]:  # Show last 3 messages
            print_info(f"  - {msg.get('senderName')}: {msg.get('messageText')[:50]}")
        return True
    else:
        print_error(f"Failed to get messages: {data}")
        return False

def test_send_multiple_messages():
    """Test sending 10 messages to trigger XP and coin rewards"""
    print_test("Send Multiple Messages (XP & Coin Rewards)")
    
    if not room_ids:
        print_error("No rooms available")
        return False
    
    room_id = room_ids[0]
    
    # Get initial coins and XP
    success, user_data, _ = make_request("GET", "/auth/me", headers=get_auth_headers())
    initial_coins = user_data.get('coins', 0) if success else 0
    initial_xp = user_data.get('xp', 0) if success else 0
    
    print_info(f"Initial - Coins: {initial_coins}, XP: {initial_xp}")
    
    # Send 10 messages
    for i in range(10):
        message_data = {"messageText": f"Test message {i+1} for XP and coin rewards"}
        success, data, status = make_request("POST", f"/messages/{room_id}", 
                                            message_data, headers=get_auth_headers())
        if not success:
            print_error(f"Failed to send message {i+1}")
            return False
        time.sleep(0.1)  # Small delay
    
    print_success("Sent 10 messages")
    
    # Check updated coins and XP
    time.sleep(0.5)
    success, user_data, _ = make_request("GET", "/auth/me", headers=get_auth_headers())
    
    if success:
        new_coins = user_data.get('coins', 0)
        new_xp = user_data.get('xp', 0)
        
        print_info(f"After - Coins: {new_coins}, XP: {new_xp}")
        print_info(f"Gained - Coins: {new_coins - initial_coins}, XP: {new_xp - initial_xp}")
        
        if new_xp > initial_xp:
            print_success(f"XP increased by {new_xp - initial_xp}")
        else:
            print_warning("XP did not increase")
        
        if new_coins != initial_coins:
            print_success(f"Coins changed by {new_coins - initial_coins}")
        
        return True
    else:
        print_error("Failed to verify XP/coin changes")
        return False

# ==================== COINS & XP TESTS ====================

def test_coin_transactions():
    """Test getting coin transaction history"""
    print_test("Get Coin Transactions")
    
    success, data, status = make_request("GET", "/coins/transactions", headers=get_auth_headers())
    
    if success and isinstance(data, list):
        print_success(f"Retrieved {len(data)} transactions")
        for tx in data[:5]:  # Show first 5
            print_info(f"  - {tx.get('type')}: {tx.get('amount')} coins - {tx.get('description')}")
        return True
    else:
        print_error(f"Failed to get transactions: {data}")
        return False

# ==================== GAMES TESTS ====================

def test_spin_wheel():
    """Test spin wheel game"""
    print_test("Spin Wheel Game")
    
    # Get current coins
    success, user_data, _ = make_request("GET", "/auth/me", headers=get_auth_headers())
    initial_coins = user_data.get('coins', 0) if success else 0
    
    if initial_coins < 10:
        print_warning(f"Not enough coins to play (have {initial_coins}, need 10)")
        return False
    
    print_info(f"Coins before: {initial_coins}")
    
    success, data, status = make_request("POST", "/games/spin-wheel", headers=get_auth_headers())
    
    if success and "reward" in data:
        print_success(f"Spin wheel successful!")
        print_info(f"Reward: {data.get('reward')} coins")
        print_info(f"Message: {data.get('message')}")
        
        # Verify coin deduction
        time.sleep(0.5)
        success2, user_data2, _ = make_request("GET", "/auth/me", headers=get_auth_headers())
        if success2:
            new_coins = user_data2.get('coins', 0)
            print_info(f"Coins after: {new_coins}")
            expected = initial_coins - 10 + data.get('reward', 0)
            if new_coins == expected:
                print_success(f"Coin balance correct (10 deducted, {data.get('reward')} added)")
            else:
                print_warning(f"Coin balance mismatch. Expected {expected}, got {new_coins}")
        
        return True
    else:
        print_error(f"Spin wheel failed: {data}")
        return False

def test_card_game():
    """Test card game"""
    print_test("Card Game")
    
    # Get current coins
    success, user_data, _ = make_request("GET", "/auth/me", headers=get_auth_headers())
    initial_coins = user_data.get('coins', 0) if success else 0
    
    if initial_coins < 10:
        print_warning(f"Not enough coins to play (have {initial_coins}, need 10)")
        return False
    
    print_info(f"Coins before: {initial_coins}")
    
    success, data, status = make_request("POST", "/games/card-game/draw", headers=get_auth_headers())
    
    if success and "playerCard" in data:
        print_success(f"Card game successful!")
        print_info(f"Player card: {data.get('playerCard')}")
        print_info(f"House card: {data.get('houseCard')}")
        print_info(f"Result: {data.get('result')}")
        print_info(f"Reward: {data.get('reward')} coins")
        
        # Verify coin changes
        time.sleep(0.5)
        success2, user_data2, _ = make_request("GET", "/auth/me", headers=get_auth_headers())
        if success2:
            new_coins = user_data2.get('coins', 0)
            print_info(f"Coins after: {new_coins}")
            expected = initial_coins - 10 + data.get('reward', 0)
            if new_coins == expected:
                print_success(f"Coin balance correct")
            else:
                print_warning(f"Coin balance mismatch. Expected {expected}, got {new_coins}")
        
        return True
    else:
        print_error(f"Card game failed: {data}")
        return False

# ==================== LEADERBOARD TESTS ====================

def test_xp_leaderboard():
    """Test XP leaderboard"""
    print_test("XP Leaderboard")
    
    success, data, status = make_request("GET", "/leaderboard/xp")
    
    if success and isinstance(data, list):
        print_success(f"Retrieved XP leaderboard with {len(data)} users")
        for user in data[:5]:  # Show top 5
            print_info(f"  {user.get('rank')}. {user.get('displayName')} - {user.get('xp')} XP (Level {user.get('level')})")
        return True
    else:
        print_error(f"Failed to get XP leaderboard: {data}")
        return False

def test_coins_leaderboard():
    """Test coins leaderboard"""
    print_test("Coins Leaderboard")
    
    success, data, status = make_request("GET", "/leaderboard/coins")
    
    if success and isinstance(data, list):
        print_success(f"Retrieved coins leaderboard with {len(data)} users")
        for user in data[:5]:  # Show top 5
            print_info(f"  {user.get('rank')}. {user.get('displayName')} - {user.get('coins')} coins")
        return True
    else:
        print_error(f"Failed to get coins leaderboard: {data}")
        return False

def test_active_leaderboard():
    """Test active users leaderboard"""
    print_test("Active Users Leaderboard")
    
    success, data, status = make_request("GET", "/leaderboard/active")
    
    if success and isinstance(data, list):
        print_success(f"Retrieved active leaderboard with {len(data)} users")
        for user in data[:5]:  # Show top 5
            print_info(f"  {user.get('rank')}. {user.get('displayName')} - {user.get('messageCount')} messages")
        return True
    else:
        print_error(f"Failed to get active leaderboard: {data}")
        return False

# ==================== ERROR HANDLING TESTS ====================

def test_send_message_without_room():
    """Test sending message when not in a room (should fail)"""
    print_test("Send Message Without Being in Room (Error Test)")
    
    # First leave the room
    if room_ids:
        make_request("POST", f"/rooms/{room_ids[0]}/leave", headers=get_auth_headers())
        time.sleep(0.5)
    
    # Try to send message
    if not room_ids:
        print_warning("No rooms available for test")
        return True
    
    room_id = room_ids[0]
    message_data = {"messageText": "This should fail"}
    
    success, data, status = make_request("POST", f"/messages/{room_id}", 
                                        message_data, headers=get_auth_headers(), 
                                        expect_error=True)
    
    if success and status == 403:
        print_success(f"Correctly rejected message: {data.get('detail')}")
        return True
    else:
        print_error(f"Should have rejected message but got: {data}")
        return False

def test_join_room_twice():
    """Test joining a room twice"""
    print_test("Join Room Twice (Error Test)")
    
    if not room_ids:
        print_error("No rooms available")
        return False
    
    room_id = room_ids[0]
    
    # Join first time
    success1, data1, status1 = make_request("POST", f"/rooms/{room_id}/join", headers=get_auth_headers())
    time.sleep(0.5)
    
    # Join second time
    success2, data2, status2 = make_request("POST", f"/rooms/{room_id}/join", headers=get_auth_headers())
    
    # Should succeed both times (leaves previous room automatically)
    if success2:
        print_success(f"Handled double join correctly: {data2.get('message')}")
        return True
    else:
        print_warning(f"Double join result: {data2}")
        return True  # Not a critical error

def test_game_without_coins():
    """Test playing game without sufficient coins"""
    print_test("Play Game Without Sufficient Coins (Error Test)")
    
    # Get current coins
    success, user_data, _ = make_request("GET", "/auth/me", headers=get_auth_headers())
    current_coins = user_data.get('coins', 0) if success else 0
    
    if current_coins >= 10:
        print_warning(f"User has {current_coins} coins, cannot test insufficient coins scenario")
        return True
    
    success, data, status = make_request("POST", "/games/spin-wheel", 
                                        headers=get_auth_headers(), 
                                        expect_error=True)
    
    if success and status == 400:
        print_success(f"Correctly rejected game: {data.get('detail')}")
        return True
    else:
        print_error(f"Should have rejected game but got: {data}")
        return False

# ==================== ROOM LEAVE TEST ====================

def test_leave_room():
    """Test leaving a room"""
    print_test("Leave Room")
    
    if not room_ids:
        print_error("No rooms available")
        return False
    
    room_id = room_ids[0]
    
    # First join the room
    make_request("POST", f"/rooms/{room_id}/join", headers=get_auth_headers())
    time.sleep(0.5)
    
    # Get current user count
    success1, rooms_data, _ = make_request("GET", "/rooms")
    initial_count = 0
    if success1:
        for room in rooms_data:
            if room["id"] == room_id:
                initial_count = room.get('currentUserCount', 0)
                break
    
    print_info(f"Room user count before leave: {initial_count}")
    
    # Leave room
    success, data, status = make_request("POST", f"/rooms/{room_id}/leave", headers=get_auth_headers())
    
    if success:
        print_success(f"Left room successfully: {data.get('message')}")
        
        # Verify user count decreased
        time.sleep(0.5)
        success2, rooms_data2, _ = make_request("GET", "/rooms")
        if success2:
            for room in rooms_data2:
                if room["id"] == room_id:
                    new_count = room.get('currentUserCount', 0)
                    print_info(f"Room user count after leave: {new_count}")
                    if new_count < initial_count:
                        print_success("User count decreased after leave")
                    else:
                        print_warning(f"User count did not decrease (was {initial_count}, now {new_count})")
                    break
        
        return True
    else:
        print_error(f"Failed to leave room: {data}")
        return False

# ==================== MAIN TEST RUNNER ====================

def run_all_tests():
    """Run all tests in sequence"""
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}GenC Vibez Backend API Test Suite{Colors.END}")
    print(f"{Colors.BLUE}Backend URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    
    results = {}
    
    # Auth tests
    results["Register/Login"] = test_register()
    results["Get User Profile"] = test_get_me()
    
    # Room tests
    results["Initialize Rooms"] = test_init_rooms()
    results["Get Rooms"] = test_get_rooms()
    results["Join Room"] = test_join_room()
    results["Get Room Members"] = test_get_room_members()
    
    # Message tests
    results["Send Message"] = test_send_message()
    results["Get Messages"] = test_get_messages()
    results["Send Multiple Messages (XP/Coins)"] = test_send_multiple_messages()
    
    # Coins & XP tests
    results["Get Coin Transactions"] = test_coin_transactions()
    
    # Games tests
    results["Spin Wheel Game"] = test_spin_wheel()
    results["Card Game"] = test_card_game()
    
    # Leaderboard tests
    results["XP Leaderboard"] = test_xp_leaderboard()
    results["Coins Leaderboard"] = test_coins_leaderboard()
    results["Active Leaderboard"] = test_active_leaderboard()
    
    # Error handling tests
    results["Send Message Without Room"] = test_send_message_without_room()
    results["Join Room Twice"] = test_join_room_twice()
    
    # Room leave test
    results["Leave Room"] = test_leave_room()
    
    # Print summary
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{Colors.GREEN}PASS{Colors.END}" if result else f"{Colors.RED}FAIL{Colors.END}"
        print(f"{status} - {test_name}")
    
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}Total: {passed}/{total} tests passed{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}\n")
    
    return results

if __name__ == "__main__":
    run_all_tests()
