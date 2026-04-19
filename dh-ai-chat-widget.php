<?php
/**
 * Plugin Name: DH AI Chat Widget
 * Plugin URI: https://deepakhasija.com
 * Description: A beautiful floating AI chat widget powered by Claude AI. Engage visitors instantly with smart, branded conversations.
 * Version: 1.0.0
 * Author: Deepak Hasija
 * Author URI: https://deepakhasija.com
 * License: GPL v2 or later
 * Text Domain: dh-ai-chat-widget
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'DH_CHAT_VERSION', '1.0.0' );
define( 'DH_CHAT_PATH', plugin_dir_path( __FILE__ ) );
define( 'DH_CHAT_URL', plugin_dir_url( __FILE__ ) );

class DH_AI_Chat_Widget {

    private static $instance = null;

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_assets' ] );
        add_action( 'wp_footer', [ $this, 'render_widget' ] );
        add_action( 'admin_menu', [ $this, 'admin_menu' ] );
        add_action( 'admin_init', [ $this, 'register_settings' ] );
        add_action( 'wp_ajax_dh_chat_message', [ $this, 'handle_chat_message' ] );
        add_action( 'wp_ajax_nopriv_dh_chat_message', [ $this, 'handle_chat_message' ] );
    }

    public function enqueue_assets() {
        $options = get_option( 'dh_chat_options', [] );
        if ( ! empty( $options['disable_widget'] ) ) return;

        wp_enqueue_style(
            'dh-chat-widget',
            DH_CHAT_URL . 'assets/chat-widget.css',
            [],
            DH_CHAT_VERSION
        );

        wp_enqueue_script(
            'dh-chat-widget',
            DH_CHAT_URL . 'assets/chat-widget.js',
            [],
            DH_CHAT_VERSION,
            true
        );

        wp_localize_script( 'dh-chat-widget', 'dhChatConfig', [
            'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
            'nonce'        => wp_create_nonce( 'dh_chat_nonce' ),
            'agentName'    => $options['agent_name'] ?? 'Deepak',
            'agentTitle'   => $options['agent_title'] ?? 'WordPress & AI Expert',
            'agentAvatar'  => $options['agent_avatar'] ?? DH_CHAT_URL . 'assets/avatar-placeholder.svg',
            'brandColor'   => $options['brand_color'] ?? '#0D9488',
            'greeting'     => $options['greeting'] ?? 'Hi! I\'m Deepak\'s AI assistant. I can answer questions about WordPress development, AI integration, and how I can help your business. What\'s on your mind?',
            'pillLabel'    => $options['pill_label'] ?? 'Chat with Deepak\'s AI',
            'logoUrl'      => $options['logo_url'] ?? '',
        ] );
    }

    public function render_widget() {
        $options = get_option( 'dh_chat_options', [] );
        if ( ! empty( $options['disable_widget'] ) ) return;
        echo '<div id="dh-chat-root"></div>';
    }

    public function handle_chat_message() {
        check_ajax_referer( 'dh_chat_nonce', 'nonce' );

        $options     = get_option( 'dh_chat_options', [] );
        $api_key     = $options['api_key'] ?? '';
        $system_prompt = $options['system_prompt'] ?? $this->default_system_prompt();

        if ( empty( $api_key ) ) {
            wp_send_json_error( [ 'message' => 'API key not configured.' ] );
        }

        $messages = isset( $_POST['messages'] ) ? json_decode( stripslashes( $_POST['messages'] ), true ) : [];
        if ( empty( $messages ) || ! is_array( $messages ) ) {
            wp_send_json_error( [ 'message' => 'Invalid messages.' ] );
        }

        // Sanitize messages
        $clean_messages = array_map( function( $msg ) {
            return [
                'role'    => sanitize_text_field( $msg['role'] ?? 'user' ),
                'content' => sanitize_textarea_field( $msg['content'] ?? '' ),
            ];
        }, $messages );

        $payload = [
            'model'      => 'claude-opus-4-5',
            'max_tokens' => 500,
            'system'     => $system_prompt,
            'messages'   => $clean_messages,
        ];

        $response = wp_remote_post( 'https://api.anthropic.com/v1/messages', [
            'timeout' => 30,
            'headers' => [
                'Content-Type'      => 'application/json',
                'x-api-key'         => $api_key,
                'anthropic-version' => '2023-06-01',
            ],
            'body' => json_encode( $payload ),
        ] );

        if ( is_wp_error( $response ) ) {
            wp_send_json_error( [ 'message' => 'Connection error. Please try again.' ] );
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( ! empty( $body['content'][0]['text'] ) ) {
            wp_send_json_success( [ 'reply' => $body['content'][0]['text'] ] );
        } else {
            wp_send_json_error( [ 'message' => 'No response from AI. Please try again.' ] );
        }
    }

    private function default_system_prompt() {
        return "You are Deepak Hasija's AI assistant on his professional website deepakhasija.com. Deepak is a senior WordPress developer and AI integration expert based in New Delhi with 12+ years of experience. He specializes in WordPress, Divi, WooCommerce, PHP, and integrating AI tools into client workflows.

Your role: Help visitors understand Deepak's services, answer questions about WordPress development and AI integration, qualify leads, and encourage them to book a free discovery call at https://calendly.com/eventswow-support/30min.

Key services: Custom WordPress development, Divi/Elementor builds, WooCommerce stores, AI tool integration, white-label agency work, SEO, and automation with Zapier.

Be friendly, concise, and professional. If someone has a project need, ask clarifying questions and guide them toward booking a call. Keep replies under 3 paragraphs. Never make up prices — say Deepak discusses rates on discovery calls.";
    }

    public function admin_menu() {
        add_options_page(
            'DH AI Chat Widget',
            'DH AI Chat',
            'manage_options',
            'dh-ai-chat',
            [ $this, 'settings_page' ]
        );
    }

    public function register_settings() {
        register_setting( 'dh_chat_settings', 'dh_chat_options', [
            'sanitize_callback' => [ $this, 'sanitize_options' ],
        ] );
    }

    public function sanitize_options( $input ) {
        $clean = [];
        $clean['api_key']       = sanitize_text_field( $input['api_key'] ?? '' );
        $clean['agent_name']    = sanitize_text_field( $input['agent_name'] ?? 'Deepak' );
        $clean['agent_title']   = sanitize_text_field( $input['agent_title'] ?? '' );
        $clean['agent_avatar']  = esc_url_raw( $input['agent_avatar'] ?? '' );
        $clean['logo_url']      = esc_url_raw( $input['logo_url'] ?? '' );
        $clean['brand_color']   = sanitize_hex_color( $input['brand_color'] ?? '#0D9488' );
        $clean['greeting']      = sanitize_textarea_field( $input['greeting'] ?? '' );
        $clean['pill_label']    = sanitize_text_field( $input['pill_label'] ?? '' );
        $clean['system_prompt'] = sanitize_textarea_field( $input['system_prompt'] ?? '' );
        $clean['disable_widget'] = ! empty( $input['disable_widget'] ) ? 1 : 0;
        return $clean;
    }

    public function settings_page() {
        $options = get_option( 'dh_chat_options', [] );
        ?>
        <div class="wrap">
            <h1>🤖 DH AI Chat Widget</h1>
            <p style="color:#666;">Configure your AI-powered floating chat widget.</p>

            <?php settings_errors(); ?>

            <form method="post" action="options.php">
                <?php settings_fields( 'dh_chat_settings' ); ?>

                <table class="form-table">
                    <tr>
                        <th><label for="api_key">Claude API Key <span style="color:red">*</span></label></th>
                        <td>
                            <input type="password" id="api_key" name="dh_chat_options[api_key]"
                                value="<?php echo esc_attr( $options['api_key'] ?? '' ); ?>"
                                class="regular-text" placeholder="sk-ant-..." />
                            <p class="description">Get your key at <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a></p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="agent_name">Agent Name</label></th>
                        <td>
                            <input type="text" id="agent_name" name="dh_chat_options[agent_name]"
                                value="<?php echo esc_attr( $options['agent_name'] ?? 'Deepak' ); ?>"
                                class="regular-text" />
                        </td>
                    </tr>
                    <tr>
                        <th><label for="agent_title">Agent Title</label></th>
                        <td>
                            <input type="text" id="agent_title" name="dh_chat_options[agent_title]"
                                value="<?php echo esc_attr( $options['agent_title'] ?? 'WordPress & AI Expert' ); ?>"
                                class="regular-text" />
                        </td>
                    </tr>
                    <tr>
                        <th><label for="agent_avatar">Agent Avatar URL</label></th>
                        <td>
                            <input type="url" id="agent_avatar" name="dh_chat_options[agent_avatar]"
                                value="<?php echo esc_attr( $options['agent_avatar'] ?? '' ); ?>"
                                class="regular-text" placeholder="https://..." />
                            <p class="description">Your photo URL. Leave blank for initials avatar.</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="logo_url">Logo URL (pill button)</label></th>
                        <td>
                            <input type="url" id="logo_url" name="dh_chat_options[logo_url]"
                                value="<?php echo esc_attr( $options['logo_url'] ?? '' ); ?>"
                                class="regular-text" placeholder="https://..." />
                            <p class="description">Small logo shown in the pill trigger button (like the Arctic Grey example).</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="brand_color">Brand Color</label></th>
                        <td>
                            <input type="color" id="brand_color" name="dh_chat_options[brand_color]"
                                value="<?php echo esc_attr( $options['brand_color'] ?? '#0D9488' ); ?>" />
                        </td>
                    </tr>
                    <tr>
                        <th><label for="pill_label">Pill Button Label</label></th>
                        <td>
                            <input type="text" id="pill_label" name="dh_chat_options[pill_label]"
                                value="<?php echo esc_attr( $options['pill_label'] ?? "Chat with Deepak's AI" ); ?>"
                                class="regular-text" />
                        </td>
                    </tr>
                    <tr>
                        <th><label for="greeting">Opening Greeting</label></th>
                        <td>
                            <textarea id="greeting" name="dh_chat_options[greeting]" rows="3" class="large-text"><?php echo esc_textarea( $options['greeting'] ?? '' ); ?></textarea>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="system_prompt">AI System Prompt</label></th>
                        <td>
                            <textarea id="system_prompt" name="dh_chat_options[system_prompt]" rows="8" class="large-text"><?php echo esc_textarea( $options['system_prompt'] ?? $this->default_system_prompt() ); ?></textarea>
                            <p class="description">Instructions that define how the AI behaves. Be specific about your services and goals.</p>
                        </td>
                    </tr>
                    <tr>
                        <th>Disable Widget</th>
                        <td>
                            <label>
                                <input type="checkbox" name="dh_chat_options[disable_widget]" value="1"
                                    <?php checked( 1, $options['disable_widget'] ?? 0 ); ?> />
                                Temporarily hide the widget from the frontend
                            </label>
                        </td>
                    </tr>
                </table>

                <?php submit_button( 'Save Settings' ); ?>
            </form>
        </div>
        <?php
    }
}

DH_AI_Chat_Widget::get_instance();
